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
import { normalizeLinkedInUrl } from 'src/engine/core-modules/candidate-sourcing/utils/linkedin-url.utils';
import { SourcingLedgerService } from 'src/engine/core-modules/outreach-command/services/sourcing-ledger.service';
import { OutreachWorkingSetService } from 'src/engine/core-modules/outreach-command/services/outreach-working-set.service';
import { HarvestLinkedinService } from 'src/engine/core-modules/org-chart/services/harvest-linkedin.service';

// Bright Data takes many URLs in one request; a few requests run side by side
const BRIGHT_DATA_BATCH_SIZE = 20;
const BRIGHT_DATA_CONCURRENCY = 4;
// Business Search answers one URL in about 2 seconds, so many run side by side
const BUSINESS_SEARCH_CONCURRENCY = 10;
const HARVEST_CONCURRENCY = 6;
const DEFAULT_ROW_LIMIT = 100;
const DEFAULT_TIME_BUDGET_MS = 75_000;
const MAX_REPORTED_FAILURES = 10;

export type FetchProfilesSource = 'bright_data' | 'harvest';

export type FetchProfilesInput = {
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
  skipped: {
    noLinkedinUrl: number;
    alreadyFetched: number;
    filteredByOutcome: number;
  };
  // Rows still waiting for a profile after this call: call again to continue
  remaining: number;
  timedOut: boolean;
  durationMs: number;
};

type Target = { id: string; name: string; linkedinUrl: string; key: string };

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
    const seenKeys = new Set<string>();

    for (const row of rows) {
      const linkedinUrl = (row.linkedinUrl ?? '').trim();

      if (linkedinUrl === '') {
        skipped.noLinkedinUrl += 1;
        continue;
      }

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

      const key = urlKey(linkedinUrl);

      // Two rows for one person cost one fetch
      if (seenKeys.has(key)) {
        continue;
      }

      seenKeys.add(key);
      pending.push({ id: row.id, name: row.name, linkedinUrl, key });
    }

    const targets = pending.slice(0, input.rowLimit ?? DEFAULT_ROW_LIMIT);
    const profiles = new Map<string, RowProfile>();
    // Bright Data also keeps the provider record so row columns match find_role
    const brightDataRecords = new Map<string, Record<string, unknown>>();
    const fetched = { brightData: 0, harvest: 0 };
    const sources = input.sources ?? ['bright_data', 'harvest'];
    const useBrightData = sources.includes('bright_data');
    const useHarvest = sources.includes('harvest');

    if (useBrightData) {
      const onBrightDataProfile = (
        target: Target,
        profile: RowProfile,
        record: Record<string, unknown>,
      ) => {
        profiles.set(target.id, profile);
        brightDataRecords.set(target.id, record);
        fetched.brightData += 1;
      };

      // Business Search first (seconds); the slow URL scrape only for the
      // people it does not know
      await this.fetchFromBusinessSearch(
        targets,
        deadline,
        onBrightDataProfile,
      );
      await this.fetchFromBrightData(
        targets.filter((target) => !profiles.has(target.id)),
        deadline,
        onBrightDataProfile,
      );
      await this.writeBrightDataProfiles(input, brightDataRecords);
    }

    const missing = targets.filter((target) => !profiles.has(target.id));
    const harvested = new Map<string, RowProfile>();

    if (useHarvest && missing.length > 0) {
      await this.fetchFromHarvest(missing, deadline, (target, profile) => {
        harvested.set(target.id, profile);
        profiles.set(target.id, profile);
        fetched.harvest += 1;
      });
      await this.writeProfiles(input, harvested);
    }

    const failed = targets.filter((target) => !profiles.has(target.id));
    const remaining =
      pending.length -
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
      remaining,
      timedOut: Date.now() >= deadline,
      durationMs: Date.now() - startedAt,
    };
  }

  private async fetchFromBusinessSearch(
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
      !this.brightDataBusinessSearchService.isConfigured()
    ) {
      return;
    }

    await runPool(targets, BUSINESS_SEARCH_CONCURRENCY, async (target) => {
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
      } catch (error) {
        this.logger.warn(
          `Bright Data business search profile lookup failed: ${error instanceof Error ? error.message : String(error)}`,
        );
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
