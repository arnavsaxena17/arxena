import { Injectable, Logger, Optional } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';

import { BrightDataBusinessSearchService } from 'src/engine/core-modules/bright-data/services/bright-data-business-search.service';
import { BrightDataLinkedinProfileScrapeService } from 'src/engine/core-modules/bright-data/services/bright-data-linkedin-profile-scrape.service';
import { type BrightDataLinkedinProfileRecord } from 'src/engine/core-modules/bright-data/types/bright-data-linkedin-profile.types';
import { type FitmentVerdict } from 'src/engine/core-modules/candidate-sourcing/services/fitment/fitment-score.util';
import { brightDataRecordToPersonOtherFields } from 'src/engine/core-modules/candidate-sourcing/services/profile-fetch/bright-data-person-row-fields.util';
import {
  PROFILE_FIELD_KEY,
  isUsableProfile,
  profileToRowProfile,
  readRowProfile,
  type RowProfile,
} from 'src/engine/core-modules/candidate-sourcing/services/profile-fetch/profile-row-fields.util';
import { BrightDataPersonFitFilterService } from 'src/engine/core-modules/bright-data/services/bright-data-person-fit-filter.service';
import { profileMatchesCompany } from 'src/engine/core-modules/tool/tools/fetch-profiles-tool/utils/profile-match.util';
import {
  LinkedinProfileResolverService,
  type ResolvedLinkedinProfile,
} from 'src/engine/core-modules/tool/tools/find-role-at-companies-tool/linkedin-profile-resolver.service';
import { normalizeLinkedInUrl } from 'src/engine/core-modules/candidate-sourcing/utils/linkedin-url.utils';
import { SourcingLedgerService } from 'src/engine/core-modules/outreach-command/services/sourcing-ledger.service';
import { OutreachWorkingSetService } from 'src/engine/core-modules/outreach-command/services/outreach-working-set.service';
import { HarvestLinkedinService } from 'src/engine/core-modules/org-chart/services/harvest-linkedin.service';

// Bright Data takes many URLs in one request; a few requests run side by side
const BRIGHT_DATA_BATCH_SIZE = 20;
const BRIGHT_DATA_CONCURRENCY = 4;
// Business Search answers one URL in about 2 seconds, but rate-limits bursts
// (HTTP 429), so only a few run side by side and all pause together on a 429
const BUSINESS_SEARCH_CONCURRENCY = 4;
const BUSINESS_SEARCH_RATE_LIMIT_PAUSE_MS = 5_000;
const BUSINESS_SEARCH_MAX_ATTEMPTS = 3;
const HARVEST_CONCURRENCY = 6;
const DEFAULT_ROW_LIMIT = 100;
const DEFAULT_TIME_BUDGET_MS = 75_000;
const MAX_REPORTED_FAILURES = 10;

export type FetchProfilesSource = 'bright_data' | 'harvest';

export type FetchProfilesProgress = {
  phase: string;
  fetched: number;
  total: number;
  lookupErrors: number;
  lastError?: string;
};

export type FetchProfilesInput = {
  // Called whenever the phase or the number of fetched profiles changes
  onProgress?: (progress: FetchProfilesProgress) => void;
  workspaceId: string;
  projectId: string;
  // Rows whose fitment outcome is one of these are fetched. Rows with no
  // fitment outcome yet are always fetched.
  outcomes?: FitmentVerdict[];
  rowLimit?: number;
  // Fetch again rows that already have a profile
  refresh?: boolean;
  // Default: Bright Data then Harvest. Pass ["bright_data"] to skip Harvest.
  sources?: FetchProfilesSource[];
  timeBudgetMs?: number;
};

export type FetchProfilesResult = {
  requested: number;
  fetched: { brightData: number; harvest: number };
  failed: Array<{ id: string; name: string; linkedinUrl: string }>;
  // People with no LinkedIn URL on the row, found by name and company
  resolvedLinkedinUrls: { businessSearch: number; google: number };
  skipped: {
    noLinkedinUrl: number;
    alreadyFetched: number;
    filteredByOutcome: number;
  };
  // Rows still waiting for a profile after this call: call again to continue
  remaining: number;
  // Lookups that failed on the network or the API (not "person not found")
  lookupErrors: number;
  timedOut: boolean;
  durationMs: number;
};

// linkedinUrl is empty for a person found by name and company only; the
// company is what tells two people with one name apart
type Target = {
  id: string;
  name: string;
  linkedinUrl: string;
  key: string;
  companyName?: string;
  title?: string;
};

// Each person is one Business Search query, a Google search when it finds
// nobody, and one model call, so only a few run side by side
const NAME_LOOKUP_CONCURRENCY = 4;

const urlKey = (url: string): string => {
  try {
    return normalizeLinkedInUrl(url);
  } catch {
    return url.trim().toLowerCase();
  }
};

const runPool = async <TItem>(
  items: TItem[],
  limit: number,
  worker: (item: TItem) => Promise<void>,
): Promise<void> => {
  let next = 0;

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        await worker(items[next++]);
      }
    }),
  );
};

// Fetches the full profile of every person on the project's People tab that
// still needs one. Bright Data first, in parallel batches; Harvest for the
// profiles it did not return. Bounded in time and resumable: rows that already
// hold a profile are skipped, so calling again continues where it stopped.
@Injectable()
export class FetchProfilesService {
  private readonly logger = new Logger(FetchProfilesService.name);

  constructor(
    private readonly outreachWorkingSetService: OutreachWorkingSetService,
    private readonly brightDataBusinessSearchService: BrightDataBusinessSearchService,
    private readonly brightDataProfileScrapeService: BrightDataLinkedinProfileScrapeService,
    private readonly harvestLinkedinService: HarvestLinkedinService,
    @Optional()
    private readonly sourcingLedgerService?: SourcingLedgerService,
    @Optional()
    private readonly linkedinProfileResolverService?: LinkedinProfileResolverService,
    @Optional()
    private readonly personFitFilterService?: BrightDataPersonFitFilterService,
  ) {}

  async fetch(input: FetchProfilesInput): Promise<FetchProfilesResult> {
    const startedAt = Date.now();
    const deadline = startedAt + (input.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS);
    const outcomes = input.outcomes ?? ['pass', 'unknown'];
    const rows = await this.outreachWorkingSetService.getAll({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      subject: 'person',
    });
    const skipped = {
      noLinkedinUrl: 0,
      alreadyFetched: 0,
      filteredByOutcome: 0,
    };
    const pending: Target[] = [];
    const unresolved: Target[] = [];
    const seenKeys = new Set<string>();

    for (const row of rows) {
      const linkedinUrl = (row.linkedinUrl ?? '').trim();

      if (!input.refresh && isDefined(readRowProfile(row.otherFields))) {
        skipped.alreadyFetched += 1;
        continue;
      }

      // CRM-backed rows keep their keys in snake case
      const outcome =
        row.otherFields.fitmentOutcome ?? row.otherFields.fitment_outcome;

      if (
        typeof outcome === 'string' &&
        !outcomes.includes(outcome as FitmentVerdict)
      ) {
        skipped.filteredByOutcome += 1;
        continue;
      }

      if (linkedinUrl === '') {
        const companyName = (row.companyName ?? '').trim();

        // Without a company a name finds namesakes, so there is nothing to search
        if (row.name.trim() === '' || companyName === '') {
          skipped.noLinkedinUrl += 1;
        } else {
          unresolved.push({
            id: row.id,
            name: row.name,
            linkedinUrl: '',
            key: `row:${row.id}`,
            companyName,
            title: row.title,
          });
        }

        continue;
      }

      const key = urlKey(linkedinUrl);

      // Two rows for one person cost one fetch
      if (seenKeys.has(key)) {
        continue;
      }

      seenKeys.add(key);
      pending.push({ id: row.id, name: row.name, linkedinUrl, key });
    }

    const rowLimit = input.rowLimit ?? DEFAULT_ROW_LIMIT;
    const withUrl = pending.slice(0, rowLimit);
    const withoutUrl = unresolved.slice(
      0,
      Math.max(0, rowLimit - withUrl.length),
    );
    const targets = [...withUrl, ...withoutUrl];
    const resolvedLinkedinUrls = { businessSearch: 0, google: 0 };
    const profiles = new Map<string, RowProfile>();
    // Bright Data also keeps the provider record so row columns match find_role
    const brightDataRecords = new Map<string, Record<string, unknown>>();
    const fetched = { brightData: 0, harvest: 0 };
    const lookupErrors: {
      count: number;
      lastError?: string;
      notify?: () => void;
    } = { count: 0 };
    let currentPhase = 'Starting';
    const sources = input.sources ?? ['bright_data', 'harvest'];
    const useBrightData = sources.includes('bright_data');
    const useHarvest = sources.includes('harvest');
    const reportProgress = (phase: string) => {
      currentPhase = phase;
      input.onProgress?.({
        phase,
        fetched: fetched.brightData + fetched.harvest,
        total: targets.length,
        lookupErrors: lookupErrors.count,
        lastError: lookupErrors.lastError,
      });
    };

    lookupErrors.notify = () => reportProgress(currentPhase);

    reportProgress(
      `Checking ${targets.length} profile(s) (${skipped.alreadyFetched} already have one, ${withoutUrl.length} have no LinkedIn URL and will be searched by name, ${skipped.noLinkedinUrl} cannot be searched)`,
    );

    if (useBrightData) {
      const onBrightDataProfile = (
        target: Target,
        profile: RowProfile,
        record: Record<string, unknown>,
      ) => {
        profiles.set(target.id, profile);
        brightDataRecords.set(target.id, record);
        fetched.brightData += 1;
        reportProgress('Fetching profiles from Bright Data');
      };

      // People with no URL: Business Search by name and company first, Google
      // for the ones it does not match, a model to say which candidate is the
      // person; the URL found goes through Business Search by URL below
      if (withoutUrl.length > 0) {
        reportProgress(
          `Finding the LinkedIn URL of ${withoutUrl.length} person(s) by name and company (Bright Data, then Google)`,
        );
        await this.resolveWithoutUrl({
          workspaceId: input.workspaceId,
          targets: withoutUrl,
          deadline,
          resolvedLinkedinUrls,
          lookupErrors,
        });
      }

      // Business Search by URL first (seconds); the slow URL scrape only for the
      // people it does not know
      await this.fetchFromBusinessSearch(
        targets.filter(
          (target) => target.linkedinUrl !== '' && !profiles.has(target.id),
        ),
        deadline,
        onBrightDataProfile,
        lookupErrors,
      );
      const unknownToSearch = targets.filter(
        (target) => target.linkedinUrl !== '' && !profiles.has(target.id),
      );

      if (unknownToSearch.length > 0) {
        reportProgress(
          `Scraping ${unknownToSearch.length} profile(s) Business Search did not know (slower, can take minutes)`,
        );
      }

      await this.fetchFromBrightData(
        unknownToSearch,
        deadline,
        onBrightDataProfile,
      );
      await this.writeBrightDataProfiles(input, brightDataRecords);
    }

    const missing = targets.filter(
      (target) => target.linkedinUrl !== '' && !profiles.has(target.id),
    );
    const harvested = new Map<string, RowProfile>();

    if (useHarvest && missing.length > 0) {
      await this.fetchFromHarvest(missing, deadline, (target, profile) => {
        harvested.set(target.id, profile);
        profiles.set(target.id, profile);
        fetched.harvest += 1;
        reportProgress('Fetching profiles from Harvest');
      });
      await this.writeProfiles(input, harvested);
    }

    const failed = targets.filter((target) => !profiles.has(target.id));
    const remaining =
      pending.length +
      unresolved.length -
      targets.length +
      (Date.now() >= deadline ? failed.length : 0);

    if (targets.length > 0) {
      await this.sourcingLedgerService?.append(
        input.workspaceId,
        input.projectId,
        {
          kind: 'profile_fetch',
          at: new Date().toISOString(),
          requested: targets.length,
          brightData: fetched.brightData,
          harvest: fetched.harvest,
          notFound: failed.length,
          resolvedByName: resolvedLinkedinUrls.businessSearch,
          resolvedByGoogle: resolvedLinkedinUrls.google,
          remaining,
        },
      );
    }

    return {
      requested: targets.length,
      fetched,
      failed: failed.slice(0, MAX_REPORTED_FAILURES).map((target) => ({
        id: target.id,
        name: target.name,
        linkedinUrl: target.linkedinUrl,
      })),
      skipped,
      resolvedLinkedinUrls,
      remaining,
      lookupErrors: lookupErrors.count,
      timedOut: Date.now() >= deadline,
      durationMs: Date.now() - startedAt,
    };
  }

  // The resolver finds the profiles that carry the person's name (Bright Data by
  // name and company, Google for the misses); a model then says which of them
  // works at the company on the row. Without a model, the company on the
  // profile is matched by name instead.
  private async resolveWithoutUrl({
    workspaceId,
    targets,
    deadline,
    resolvedLinkedinUrls,
    lookupErrors,
  }: {
    workspaceId: string;
    targets: Target[];
    deadline: number;
    resolvedLinkedinUrls: { businessSearch: number; google: number };
    lookupErrors: { count: number; lastError?: string; notify?: () => void };
  }): Promise<void> {
    const resolver = this.linkedinProfileResolverService;

    if (!isDefined(resolver)) {
      return;
    }

    await runPool(targets, NAME_LOOKUP_CONCURRENCY, async (target) => {
      if (Date.now() >= deadline) {
        return;
      }

      const companyName = target.companyName ?? '';

      try {
        const { profiles, errors } = await resolver.resolve({
          name: target.name,
          companyNames: [companyName],
          googleOnlyWhenBrightDataMisses: true,
        });

        if (profiles.length === 0) {
          if (errors.length > 0) {
            lookupErrors.count += 1;
            lookupErrors.lastError = errors[0];
            lookupErrors.notify?.();
          }

          return;
        }

        const chosen = await this.chooseProfile({
          workspaceId,
          target,
          profiles,
        });

        if (!isDefined(chosen)) {
          return;
        }

        target.linkedinUrl = chosen.linkedinUrl;
        target.key = urlKey(chosen.linkedinUrl);

        if (chosen.via === 'google') {
          resolvedLinkedinUrls.google += 1;
        } else {
          resolvedLinkedinUrls.businessSearch += 1;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        lookupErrors.count += 1;
        lookupErrors.lastError = message;
        lookupErrors.notify?.();
        this.logger.warn(`LinkedIn URL lookup by name failed: ${message}`);
      }
    });
  }

  // First candidate the model places at the row's company (the same business
  // or a related one); a namesake elsewhere is rejected. If the model is
  // unavailable, the company on the profile or in its evidence must match by name.
  private async chooseProfile({
    workspaceId,
    target,
    profiles,
  }: {
    workspaceId: string;
    target: Target;
    profiles: ResolvedLinkedinProfile[];
  }): Promise<ResolvedLinkedinProfile | undefined> {
    const companyName = target.companyName ?? '';

    if (isDefined(this.personFitFilterService)) {
      try {
        const judgements = await this.personFitFilterService.judge({
          workspaceId,
          company: companyName,
          alternateNames: [],
          roles: [target.title ?? ''].filter((role) => role !== ''),
          candidates: profiles.map((profile) => ({
            id: profile.linkedinUrl,
            name: target.name,
            title: profile.title,
            company: profile.companyName,
            location: '',
            evidence: profile.evidence,
          })),
        });

        // A verdict for every candidate: trust it. Missing verdicts (a batch
        // the model failed on) fall through to name matching below.
        if (judgements.size > 0) {
          return profiles.find((profile) => {
            const company = judgements.get(profile.linkedinUrl)?.company;

            return company === 'same' || company === 'related';
          });
        }
      } catch (error) {
        this.logger.warn(
          `Candidate judge unavailable, matching company names instead: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return profiles.find((profile) =>
      profileMatchesCompany(profile, companyName),
    );
  }

  private async fetchFromBusinessSearch(
    targets: Target[],
    deadline: number,
    onProfile: (
      target: Target,
      profile: RowProfile,
      record: Record<string, unknown>,
    ) => void,
    lookupErrors: { count: number; lastError?: string; notify?: () => void },
  ): Promise<void> {
    if (
      targets.length === 0 ||
      !this.brightDataBusinessSearchService.isConfigured()
    ) {
      return;
    }

    let pausedUntil = 0;

    await runPool(targets, BUSINESS_SEARCH_CONCURRENCY, async (target) => {
      for (
        let attempt = 1;
        attempt <= BUSINESS_SEARCH_MAX_ATTEMPTS;
        attempt++
      ) {
        const waitMs = pausedUntil - Date.now();

        if (waitMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, waitMs));
        }

        if (Date.now() >= deadline) {
          return;
        }

        try {
          const result = await this.brightDataBusinessSearchService.search({
            entity: 'people',
            mode: 'instant',
            query: target.linkedinUrl,
            limit: 3,
          });
          // Instant search is fuzzy: only the record with this exact profile URL counts
          const match = result.documents.find((document) => {
            const url = document.data.url;

            return typeof url === 'string' && urlKey(url) === target.key;
          });

          if (!isDefined(match)) {
            return;
          }

          const profile = profileToRowProfile({
            source: 'bright_data',
            record: match.data,
            fetchedAt: new Date().toISOString(),
          });

          if (isUsableProfile(profile)) {
            onProfile(target, profile, match.data);
          }

          return;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);

          if (message.includes('(429)')) {
            pausedUntil = Date.now() + BUSINESS_SEARCH_RATE_LIMIT_PAUSE_MS;
            continue;
          }

          lookupErrors.count += 1;
          lookupErrors.lastError = message;
          lookupErrors.notify?.();
          this.logger.warn(
            `Bright Data business search profile lookup failed: ${message}`,
          );

          return;
        }
      }
    });
  }

  private async fetchFromBrightData(
    targets: Target[],
    deadline: number,
    onProfile: (
      target: Target,
      profile: RowProfile,
      record: Record<string, unknown>,
    ) => void,
  ): Promise<void> {
    if (
      targets.length === 0 ||
      !this.brightDataProfileScrapeService.isConfigured()
    ) {
      return;
    }

    const batches: Target[][] = [];

    for (
      let start = 0;
      start < targets.length;
      start += BRIGHT_DATA_BATCH_SIZE
    ) {
      batches.push(targets.slice(start, start + BRIGHT_DATA_BATCH_SIZE));
    }

    await runPool(batches, BRIGHT_DATA_CONCURRENCY, async (batch) => {
      // A batch not started by the deadline is left for the next call
      if (Date.now() >= deadline) {
        return;
      }

      const records =
        await this.brightDataProfileScrapeService.scrapeProfilesByUrl(
          batch.map((target) => target.linkedinUrl),
        );
      const byKey = new Map<string, BrightDataLinkedinProfileRecord>();

      for (const record of records) {
        const url = record.input_url ?? record.url ?? '';

        if (url !== '' && !isDefined(record.error)) {
          byKey.set(urlKey(url), record);
        }
      }

      for (const target of batch) {
        const record = byKey.get(target.key);

        if (!isDefined(record)) {
          continue;
        }

        const profile = profileToRowProfile({
          source: 'bright_data',
          record,
          fetchedAt: new Date().toISOString(),
        });

        // A record with nothing to judge is a miss: Harvest gets a turn
        if (isUsableProfile(profile)) {
          onProfile(target, profile, record as Record<string, unknown>);
        }
      }
    });
  }

  private async fetchFromHarvest(
    targets: Target[],
    deadline: number,
    onProfile: (target: Target, profile: RowProfile) => void,
  ): Promise<void> {
    await runPool(targets, HARVEST_CONCURRENCY, async (target) => {
      if (Date.now() >= deadline) {
        return;
      }

      try {
        const record = await this.harvestLinkedinService.fetchProfileByUrl(
          target.linkedinUrl,
        );
        const profile = profileToRowProfile({
          source: 'harvest',
          record,
          fetchedAt: new Date().toISOString(),
        });

        if (isDefined(record) && isUsableProfile(profile)) {
          onProfile(target, profile);
        }
      } catch (error) {
        this.logger.warn(
          `Harvest profile fetch failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  private async writeBrightDataProfiles(
    input: FetchProfilesInput,
    records: Map<string, Record<string, unknown>>,
  ): Promise<void> {
    if (records.size === 0) {
      return;
    }

    await this.outreachWorkingSetService.writeOtherFields({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      subject: 'person',
      valuesByRowId: new Map(
        [...records].map(([rowId, record]) => [
          rowId,
          brightDataRecordToPersonOtherFields(record).otherFields,
        ]),
      ),
    });
  }

  private async writeProfiles(
    input: FetchProfilesInput,
    profiles: Map<string, RowProfile>,
  ): Promise<void> {
    if (profiles.size === 0) {
      return;
    }

    await this.outreachWorkingSetService.writeOtherFields({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      subject: 'person',
      valuesByRowId: new Map(
        [...profiles].map(([rowId, profile]) => [
          rowId,
          { [PROFILE_FIELD_KEY]: profile },
        ]),
      ),
    });
  }
}
