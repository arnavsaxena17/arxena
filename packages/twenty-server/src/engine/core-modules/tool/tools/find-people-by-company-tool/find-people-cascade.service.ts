import { Injectable, Logger } from '@nestjs/common';

import { createHash } from 'crypto';

import { isNonEmptyString } from '@sniptt/guards';

import { isDefined } from 'twenty-shared/utils';

import { BrightDataLudicrousSearchService } from 'src/engine/core-modules/bright-data/services/ludicrous/bright-data-ludicrous-search.service';

import { BrightDataBusinessSearchService } from 'src/engine/core-modules/bright-data/services/bright-data-business-search.service';

import { BRIGHT_DATA_COST_PER_RECORD_USD } from 'src/engine/core-modules/bright-data/ludicrous/constants/bright-data-ludicrous-pricing.const';

import { mapBrightDataPersonToSearchItem } from 'src/engine/core-modules/bright-data/utils/bright-data-business-search.util';

import {
  buildCompanyVariants,
  matchesAnyCompanyVariant,
  textMentionsAnyCompanyVariant,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/company-name-variants.util';

import {
  FindPeopleGoogleSearchService,
  type GoogleCompanySearchResult,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/find-people-google-search.service';

import { type GoogleSerpOrganicItem } from 'src/engine/core-modules/org-chart/utils/map-google-serp-organic.util';

import {
  personNamesMatch,
  personNamesRoughlyMatch,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/person-name-matching.util';

import { LinkedinProfileResolverService } from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/linkedin-profile-resolver.service';

import {
  normalizeLinkedinProfileUrl,
  parseLinkedinSerpResult,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/parse-linkedin-serp-result.util';

import {
  GoogleResultExtractionService,
  type ExtractedPerson,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/google-result-extraction.service';

import { packLinkedinUrlLookupQueries } from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/linkedin-url-lookup-query.util';

import {
  getRequestedRoleOrder,
  scoreRoleMatch,
  titleContainsWord,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/role-title-matching.util';

import { type TitleClass } from 'src/engine/core-modules/title-taxonomy/title-class.type';

import {
  TitleExpansionService,
  type ResolvedRoles,
} from 'src/engine/core-modules/title-taxonomy/title-expansion.service';

import {
  BrightDataPersonFitFilterService,
  type PersonJudgement,
} from 'src/engine/core-modules/bright-data/services/bright-data-person-fit-filter.service';

import { brightDataRecordToPersonOtherFields } from 'src/engine/core-modules/candidate-sourcing/services/profile-fetch/bright-data-person-row-fields.util';

import { type RowProfile } from 'src/engine/core-modules/candidate-sourcing/services/profile-fetch/profile-row-fields.util';
import { type DeprioritisationReason } from 'src/engine/core-modules/tool/tools/outreach-target-people-tool/outreach-people-deprioritisation.util';
import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { pairKeyOf } from 'src/engine/core-modules/outreach-command/utils/outreach-people-found.util';
import {
  confidenceOf,
  freshnessOf,
  meetsConfidence,
  rungOf,
  terminalStateOf,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/find-people-confidence.util';
import { type SourcingConfidence } from 'src/engine/core-modules/outreach-command/utils/sourcing-ledger.util';
import {
  type Candidate,
  type FindPeopleEvidence,
  type CompanyOutcome,
  type FindPeopleByCompanyTarget,
  type RejectedCandidate,
  type ResolvedInput,
  type Source,
  type VerifiedCandidate,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/find-people-by-company.types';

// Bright Data's SERP limit is 1,000 requests/min on an unfunded account and
// higher once funded (docs.brightdata.com/general/usage-monitoring/serp-rate-limit);
// a company sends about 5 queries, so 50 at a time stays inside it
const DEFAULT_COMPANY_CONCURRENCY = 50;
// A lookup that could not complete (source_error) is run again before the
// model sees it, so a blip or a laptop wake-up does not cost a model round
const DEFAULT_COMPANY_LOOKUP_RETRIES = 2;
const COMPANY_RETRY_BACKOFF_MS = [5_000, 15_000];
const MAX_VARIANTS_PER_BRIGHT_DATA_SEARCH = 2;
const BRIGHT_DATA_CANDIDATES_PER_SEARCH = 5;
const MAX_PEOPLE_PER_COMPANY = 3;
const MAX_REJECTED_PER_COMPANY = 3;
const MAX_TITLES_IN_QUERY = 8;
const MAX_NAMES_TO_RESOLVE = 5;
const MAX_EVIDENCE_PER_PERSON = 5;
// A found answer is reused across the workspace's projects for the freshness
// window the plan uses by default
const CACHE_TTL_MS = 365 * 24 * 60 * 60 * 1000;
// Up to this many employees a functional head is often the founder: the
// owner / MD pass (rung 4) runs only at or below it
const SMALL_COMPANY_EMPLOYEES = 200;
const OWNER_ROLES = ['Owner', 'Founder', 'Managing Director', 'Promoter'];
const MAX_EVIDENCE_SNIPPET_LENGTH = 300;

export const getCompanyConcurrency = (): number => {
  const configured = Number(process.env.FIND_ROLE_COMPANY_CONCURRENCY);

  return Number.isInteger(configured) && configured > 0
    ? configured
    : DEFAULT_COMPANY_CONCURRENCY;
};

const getCompanyLookupRetries = (): number => {
  const configured = Number(process.env.FIND_ROLE_COMPANY_LOOKUP_RETRIES);

  return Number.isInteger(configured) && configured >= 0
    ? configured
    : DEFAULT_COMPANY_LOOKUP_RETRIES;
};

const EMPTY_GOOGLE_RESULT: GoogleCompanySearchResult = {
  results: [],
  errors: [],
};

export const toId = (value: string): string =>
  createHash('sha1').update(value).digest('hex');

// One limit for the whole process: parallel tool calls share it, so 11 calls
// of 25 companies do not become 275 simultaneous lookups that all time out
let activeLookups = 0;
const waitingLookups: Array<() => void> = [];

const withGlobalLookupSlot = async <TResult>(
  task: () => Promise<TResult>,
): Promise<TResult> => {
  if (activeLookups >= getCompanyConcurrency()) {
    await new Promise<void>((resolve) => waitingLookups.push(resolve));
  } else {
    activeLookups += 1;
  }

  try {
    return await task();
  } finally {
    const next = waitingLookups.shift();

    if (isDefined(next)) {
      next();
    } else {
      activeLookups -= 1;
    }
  }
};

@Injectable()
export class FindPeopleCascadeService {
  private readonly logger = new Logger(FindPeopleCascadeService.name);

  constructor(
    private readonly brightDataLudicrousSearchService: BrightDataLudicrousSearchService,
    private readonly googleSearchService: FindPeopleGoogleSearchService,
    private readonly brightDataBusinessSearchService: BrightDataBusinessSearchService,
    private readonly googleResultExtractionService: GoogleResultExtractionService,
    private readonly personFitFilterService: BrightDataPersonFitFilterService,
    private readonly linkedinProfileResolverService: LinkedinProfileResolverService,
    private readonly titleExpansionService: TitleExpansionService,
    // Optional so the service still runs where no cache is wired (tests)
    @InjectCacheStorage(CacheStorageNamespace.EngineOutreachCommand)
    private readonly cache?: CacheStorageService,
  ) {}

  // The whole pair: a found answer from an earlier run is reused inside the
  // freshness window, then the cascade, then (for a small company whose role
  // is not there) the owner / MD pass when the plan allows rung 4
  async lookupPair(
    company: FindPeopleByCompanyTarget,
    input: ResolvedInput,
    resolvedRoles: ResolvedRoles,
    workspaceId: string,
  ): Promise<CompanyOutcome> {
    const cacheKey = this.cacheKeyOf(workspaceId, company, input.roles);
    const useCache = !input.plan.confidential && isDefined(this.cache);

    if (useCache) {
      const cached = await this.cache
        ?.get<CompanyOutcome>(cacheKey)
        .catch(() => undefined);

      if (isDefined(cached) && cached.terminalState === 'found') {
        return { ...cached, spentUsd: 0, sourcesUsed: ['cache'] };
      }
    }

    let outcome = await this.lookupCompanyWithRetries(
      company,
      input,
      resolvedRoles,
      workspaceId,
    );
    const budgetLeft = input.plan.perPairUsd - outcome.spentUsd;

    if (
      outcome.terminalState === 'none_found' &&
      outcome.reason !== 'source_error' &&
      input.plan.maxRung >= 4 &&
      isDefined(company.employees) &&
      company.employees <= SMALL_COMPANY_EMPLOYEES &&
      budgetLeft > 0
    ) {
      const ownerRoles =
        await this.titleExpansionService.resolveRoles(OWNER_ROLES);
      const owners = await this.lookupCompanyWithRetries(
        company,
        {
          ...input,
          roles: OWNER_ROLES,
          plan: { ...input.plan, perPairUsd: budgetLeft },
        },
        ownerRoles,
        workspaceId,
        { ownerPass: true },
      );
      const spentUsd = outcome.spentUsd + owners.spentUsd;

      outcome =
        owners.people.length > 0
          ? {
              ...owners,
              spentUsd,
              sourcesUsed: [...outcome.sourcesUsed, ...owners.sourcesUsed],
              titlesTried: [...outcome.titlesTried, ...owners.titlesTried],
            }
          : { ...outcome, spentUsd };
    }

    if (useCache && outcome.terminalState === 'found') {
      await this.cache
        ?.set(cacheKey, outcome, CACHE_TTL_MS)
        .catch(() => undefined);
    }

    return outcome;
  }

  private cacheKeyOf(
    workspaceId: string,
    company: FindPeopleByCompanyTarget,
    roles: string[],
  ): string {
    const companyKey = isNonEmptyString(company.domain)
      ? company.domain
          .trim()
          .toLowerCase()
          .replace(/^https?:\/\//, '')
          .replace(/^www\./, '')
          .split('/')[0]
      : company.name.trim().toLowerCase().replace(/\s+/g, ' ');

    return `find-people-cache:${workspaceId}:${companyKey}:${pairKeyOf(roles)}`;
  }

  // The slot is released while waiting, so a retrying company does not hold
  // back the others. Nothing was verified when the status is source_error, so
  // the last attempt simply replaces the earlier ones (spend is added up).
  async lookupCompanyWithRetries(
    company: FindPeopleByCompanyTarget,
    input: ResolvedInput,
    resolvedRoles: ResolvedRoles,
    workspaceId: string,
    options: { ownerPass?: boolean } = {},
  ): Promise<CompanyOutcome> {
    const maxRetries = getCompanyLookupRetries();
    let spentUsd = 0;
    let outcome: CompanyOutcome | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      if (attempt > 0) {
        const backoff =
          COMPANY_RETRY_BACKOFF_MS[
            Math.min(attempt - 1, COMPANY_RETRY_BACKOFF_MS.length - 1)
          ];

        await new Promise((resolve) =>
          setTimeout(resolve, backoff + Math.random() * 2_000),
        );
      }

      outcome = await withGlobalLookupSlot(() =>
        this.lookupCompany(company, input, resolvedRoles, workspaceId, options),
      ).catch(
        (error): CompanyOutcome => ({
          company: company.name,
          status: 'source_error',
          people: [],
          rejected: [],
          sourceErrors: [
            error instanceof Error ? error.message : String(error),
          ],
          spentUsd: 0,
          terminalState: 'none_found',
          reason: 'source_error',
          sourcesUsed: [],
          titlesTried: [],
        }),
      );
      spentUsd += outcome.spentUsd;

      if (outcome.status !== 'source_error') {
        break;
      }

      this.logger.warn(
        `find_people_by_company "${company.name}": lookup failed (attempt ${attempt + 1}/${maxRetries + 1}): ${outcome.sourceErrors.join('; ')}`,
      );
    }

    return { ...(outcome as CompanyOutcome), spentUsd };
  }

  // One company, cheapest source first: Bright Data people, and Google only
  // when Bright Data holds no one at the plan's confidence. The pair's spend
  // cap counts every paid step, and what was asked is kept on the outcome.
  private async lookupCompany(
    company: FindPeopleByCompanyTarget,
    input: ResolvedInput,
    resolvedRoles: ResolvedRoles,
    workspaceId: string,
    { ownerPass = false }: { ownerPass?: boolean } = {},
  ): Promise<CompanyOutcome> {
    const variants = buildCompanyVariants(
      company.name,
      company.alternateNames ?? [],
    );
    const titles = resolvedRoles.searchTitles.slice(0, MAX_TITLES_IN_QUERY);
    const query = `${titles.join(', ')} at ${company.name}`;
    const sourceErrors: string[] = [];
    const sourcesUsed: Source[] = [];
    let spentUsd = 0;
    // Where the time went, so a slow run can be traced to a stage
    const stageMilliseconds: Record<string, number> = {};
    const startedAt = Date.now();
    const timed = async <TResult>(
      stage: string,
      task: () => Promise<TResult>,
    ): Promise<TResult> => {
      const stageStartedAt = Date.now();

      try {
        return await task();
      } finally {
        stageMilliseconds[stage] = Date.now() - stageStartedAt;
      }
    };
    const budgetLeft = () => input.plan.perPairUsd - spentUsd;
    const alternateNames = company.alternateNames ?? [];

    const brightDataCandidates = input.sources.includes('bright_data')
      ? await timed('bright_data', () =>
          this.searchBrightData({
            variants,
            titles,
            location: input.location,
            maxBudgetUsd: budgetLeft(),
            workspaceId,
            roles: input.roles,
            requestedClasses: resolvedRoles.requestedClasses,
          }).catch((error) => {
            sourceErrors.push(`bright_data: ${this.describe(error)}`);

            return { candidates: [] as Candidate[], spentUsd: 0 };
          }),
        )
      : { candidates: [] as Candidate[], spentUsd: 0 };

    spentUsd += brightDataCandidates.spentUsd;

    if (input.sources.includes('bright_data')) {
      sourcesUsed.push('bright_data');
    }

    let candidates: Candidate[] = [...brightDataCandidates.candidates];
    let verdicts =
      candidates.length > 0
        ? await timed('judge', () =>
            this.judgeCandidates({
              workspaceId,
              company: company.name,
              alternateNames,
              roles: input.roles,
              location: input.location,
              candidates,
              sourceErrors,
              website: company.domain,
              industry: company.industry,
            }),
          )
        : new Map<string, PersonJudgement>();
    let { verified, rejected } = await this.verify({
      candidates,
      variants,
      roles: input.roles,
      requestedClasses: resolvedRoles.requestedClasses,
      verdicts,
    });
    const confidentEnough = (people: VerifiedCandidate[]): boolean =>
      people.some(
        (person) =>
          person.roleScore === 2 &&
          meetsConfidence(
            this.confidenceOfCandidate(person, input.plan.freshnessDays),
            input.plan.minConfidence,
          ),
      );
    let budgetExhausted = false;

    if (input.sources.includes('google') && !confidentEnough(verified)) {
      if (budgetLeft() <= 0) {
        budgetExhausted = true;
      } else {
        sourcesUsed.push('google');

        const google = await timed('google', () =>
          this.googleSearchService.searchCompany({
            variants,
            titles,
            roles: input.roles,
            location: input.location,
            domain: company.domain,
          }),
        )
          .then((result) => {
            sourceErrors.push(
              ...result.errors.map((error) => `google: ${error}`),
            );

            return result;
          })
          .catch((error) => {
            sourceErrors.push(`google: ${this.describe(error)}`);

            return EMPTY_GOOGLE_RESULT;
          });

        // The model reads the raw Google results into name, job title,
        // company and profile; what comes after only enriches and checks them
        const extracted = await timed('extract', () =>
          this.extractPeople({
            company: company.name,
            variants,
            roles: input.roles,
            results: google.results,
            workspaceId,
            sourceErrors,
          }),
        );
        const extractedCandidates = extracted
          .filter((person) => person.isCurrentRole)
          .map((person) =>
            this.toCandidate(
              person,
              isNonEmptyString(person.linkedinUrl) ? 'google' : 'web',
            ),
          );
        // Who is worth a paid lookup is decided by name and title matching;
        // the model reads each person once, after the profiles are in
        const worthLookingUp = (candidate: Candidate): boolean =>
          this.worthLookingUp(candidate, variants);
        const toEnrich = extractedCandidates.filter(
          (candidate) =>
            isNonEmptyString(candidate.linkedinUrl) &&
            worthLookingUp(candidate),
        );
        const toResolve = extractedCandidates
          .filter(
            (candidate) =>
              !isNonEmptyString(candidate.linkedinUrl) &&
              isNonEmptyString(candidate.title) &&
              worthLookingUp(candidate),
          )
          .slice(0, MAX_NAMES_TO_RESOLVE);

        // Both need Bright Data, and neither waits for the other
        const [enrichment, named] = await timed('lookup', () =>
          Promise.all([
            input.sources.includes('bright_data')
              ? this.enrichGoogleCandidates({
                  googleCandidates: toEnrich,
                  knownCandidates: brightDataCandidates.candidates,
                  maxSpendUsd: budgetLeft(),
                }).catch((error) => {
                  sourceErrors.push(
                    `google_enrichment: ${this.describe(error)}`,
                  );

                  return { candidates: [] as Candidate[], spentUsd: 0 };
                })
              : { candidates: [] as Candidate[], spentUsd: 0 },
            this.resolveNamedPeople({ candidates: toResolve, variants }),
          ]),
        );
        const enrichedById = new Map(
          enrichment.candidates.map((candidate) => [candidate.id, candidate]),
        );
        const resolvedIds = new Set(toResolve.map((candidate) => candidate.id));

        spentUsd += enrichment.spentUsd + named.spentUsd;
        sourceErrors.push(
          ...named.errors.map((error) => `linkedin_lookup: ${error}`),
        );

        const googleCandidates = [
          ...extractedCandidates
            .filter((candidate) => !resolvedIds.has(candidate.id))
            .map((candidate) => enrichedById.get(candidate.id) ?? candidate),
          ...named.candidates,
        ];
        // The Bright Data people were already read; only the new ones go to
        // the judge
        const unjudged = googleCandidates.filter(
          (candidate) => !verdicts.has(candidate.id),
        );
        const newVerdicts =
          unjudged.length > 0
            ? await timed('judge', () =>
                this.judgeCandidates({
                  workspaceId,
                  company: company.name,
                  alternateNames,
                  roles: input.roles,
                  location: input.location,
                  candidates: unjudged,
                  sourceErrors,
                  website: company.domain,
                  industry: company.industry,
                }),
              )
            : new Map<string, PersonJudgement>();

        verdicts = new Map([...verdicts, ...newVerdicts]);
        candidates = [...brightDataCandidates.candidates, ...googleCandidates];
        ({ verified, rejected } = await this.verify({
          candidates,
          variants,
          roles: input.roles,
          requestedClasses: resolvedRoles.requestedClasses,
          verdicts,
        }));
      }
    }

    const topPeople = (await this.mergeDuplicates(verified, workspaceId)).slice(
      0,
      MAX_PEOPLE_PER_COMPANY,
    );
    // nobody found while a source failed is not a miss: the answer is unknown
    const sourceFailed = sourceErrors.some((error) =>
      /deadline|fetch failed|timed out|aborted|HTTP (429|5\d\d)\b|non-JSON|rate/i.test(
        error,
      ),
    );
    const status: CompanyOutcome['status'] = topPeople.some(
      (person) => person.roleScore === 2,
    )
      ? 'matched'
      : topPeople.length > 0
        ? 'related_role_only'
        : sourceFailed
          ? 'source_error'
          : 'no_match';
    const retrievedAt = new Date().toISOString();
    const people = topPeople.map((person) => {
      const freshness = freshnessOf(
        person.rawProfile,
        input.plan.freshnessDays,
      );

      return {
        deprioritisedReasons: this.deprioritisationReasons(person.verdict),
        name: person.name,
        title: person.title,
        companyOnProfile: person.companyName,
        linkedinUrl: person.linkedinUrl,
        sources: person.sources,
        roleMatch: (person.roleScore === 2 ? 'exact' : 'related') as
          | 'exact'
          | 'related',
        ...(person.verdict?.company === 'related' && {
          companyRelation: 'related' as const,
        }),
        ...(isNonEmptyString(this.noteOf(person.verdict)) && {
          note: this.noteOf(person.verdict),
        }),
        ...(person.linkedinUrlDerivedFromPost === true && {
          linkedinUrlDerivedFromPost: true,
        }),
        ...this.profileOf(person),
        ...(isDefined(person.rawProfile)
          ? { rawProfile: person.rawProfile }
          : {}),
        rungUsed: rungOf({
          roleScore: person.roleScore,
          title: person.title,
          roles: input.roles,
          ownerPass,
        }),
        confidence: this.confidenceOfCandidate(
          person,
          input.plan.freshnessDays,
        ),
        freshness,
        evidence: this.evidenceOf(person, query, retrievedAt),
      };
    });
    const { terminalState, reason } = terminalStateOf({
      people: people.map((person) => ({
        rungUsed: person.rungUsed,
        confidence: person.confidence,
        relatedCompany: person.companyRelation === 'related',
      })),
      maxRung: input.plan.maxRung,
      minConfidence: input.plan.minConfidence,
      sourceFailed,
      budgetExhausted,
      rejectedCount: rejected.length,
    });
    // People above the plan's rung are reported, never kept: widening the
    // ladder is the plan's call
    const kept = people.filter(
      (person) => person.rungUsed <= input.plan.maxRung,
    );

    this.logger.log(
      `find_people_by_company timing "${company.name}": ${Object.entries(
        stageMilliseconds,
      )
        .map(
          ([stage, milliseconds]) =>
            `${stage} ${(milliseconds / 1000).toFixed(1)}s`,
        )
        .join(' | ')} | total ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
    );
    this.logger.log(
      `find_people_by_company "${company.name}": ${terminalState}${reason ? ` (${reason})` : ''}, ${verified.length} verified, ${rejected.length} rejected, sources ${sourcesUsed.join(' > ') || 'none'}, $${spentUsd.toFixed(3)}`,
    );

    return {
      company: company.name,
      status,
      people: kept,
      rejected: [
        ...people
          .filter((person) => person.rungUsed > input.plan.maxRung)
          .map(
            (person): RejectedCandidate => ({
              name: person.name,
              title: person.title,
              companyOnProfile: person.companyOnProfile,
              reason: 'role_mismatch',
              note: `rung ${person.rungUsed} is above the plan's rung ${input.plan.maxRung}`,
            }),
          ),
        ...rejected,
      ].slice(0, MAX_REJECTED_PER_COMPANY),
      sourceErrors: [...new Set(sourceErrors)],
      spentUsd,
      terminalState,
      ...(isDefined(reason) && { reason }),
      ...(kept.length > 0 && {
        rungUsed: Math.min(...kept.map((person) => person.rungUsed)) as
          | 1
          | 2
          | 3
          | 4,
      }),
      sourcesUsed,
      titlesTried: titles,
    };
  }

  private confidenceOfCandidate(
    person: VerifiedCandidate,
    freshnessDays: number,
  ): SourcingConfidence {
    return confidenceOf({
      sources: person.sources,
      judged: isDefined(person.verdict),
      exactRole: person.roleScore === 2,
      relatedCompany: person.verdict?.company === 'related',
      freshness: freshnessOf(person.rawProfile, freshnessDays),
      hasLinkedinUrl: isNonEmptyString(person.linkedinUrl),
    });
  }

  // What the person was found on, and the judge's reading, so the row can be
  // checked against its sources
  private evidenceOf(
    person: VerifiedCandidate,
    query: string,
    retrievedAt: string,
  ): FindPeopleEvidence[] {
    const evidence: FindPeopleEvidence[] = person.sources.map((source) => ({
      source,
      query,
      retrievedAt,
      snippet:
        source === 'bright_data' || !isNonEmptyString(person.evidenceText)
          ? `${person.title} at ${person.companyName}`.trim()
          : person.evidenceText.slice(0, MAX_EVIDENCE_SNIPPET_LENGTH),
      ...(isNonEmptyString(person.linkedinUrl) && { url: person.linkedinUrl }),
    }));
    const note = this.noteOf(person.verdict);

    if (isNonEmptyString(note)) {
      evidence.push({ source: 'judge', query, retrievedAt, snippet: note });
    }

    return evidence.slice(0, MAX_EVIDENCE_PER_PERSON);
  }

  // Two rows the model reads as one person (a spelling slip, initials, one with
  // a profile URL and one without) become one row that keeps the URL
  private async mergeDuplicates(
    verified: VerifiedCandidate[],
    workspaceId: string,
  ): Promise<VerifiedCandidate[]> {
    if (verified.length < 2) {
      return verified;
    }

    const duplicates = await this.personFitFilterService
      .findDuplicates({
        workspaceId,
        people: verified.map((person) => ({
          id: person.id,
          name: person.name,
          title: person.title,
          company: person.companyName,
          linkedinUrl: person.linkedinUrl,
        })),
      })
      .catch(() => new Map<string, string>());

    if (duplicates.size === 0) {
      return verified;
    }

    const byId = new Map(verified.map((person) => [person.id, person]));

    for (const [duplicateId, keptId] of duplicates) {
      const duplicate = byId.get(duplicateId);
      const kept = byId.get(keptId);

      if (!isDefined(duplicate) || !isDefined(kept)) {
        continue;
      }

      kept.sources = [...new Set([...kept.sources, ...duplicate.sources])];
      kept.roleScore = Math.max(kept.roleScore, duplicate.roleScore) as 1 | 2;
    }

    return verified.filter((person) => !duplicates.has(person.id));
  }

  // Rows that fail a check are still written, but below the rest of the table
  private deprioritisationReasons(
    verdict: PersonJudgement | undefined,
  ): DeprioritisationReason[] {
    if (!isDefined(verdict)) {
      return [];
    }

    const reasons: DeprioritisationReason[] = [];

    if (
      !verdict.fitsSearch ||
      verdict.company !== 'same' ||
      verdict.role !== 'exact'
    ) {
      reasons.push('query_mismatch');
    }

    if (verdict.likelyFake) {
      reasons.push('likely_fake_profile');
    }

    return reasons;
  }

  // Tries the first names one at a time and stops at the first that yields a
  // verified person, so a brand that fails is retried under its legal name
  private async searchBrightData({
    variants,
    titles,
    location,
    maxBudgetUsd,
    workspaceId,
    roles,
    requestedClasses,
  }: {
    variants: string[];
    titles: string[];
    location?: string;
    maxBudgetUsd: number;
    workspaceId: string;
    roles: string[];
    requestedClasses: TitleClass[];
  }): Promise<{ candidates: Candidate[]; spentUsd: number }> {
    const candidates: Candidate[] = [];
    let spentUsd = 0;

    for (const variant of variants.slice(
      0,
      MAX_VARIANTS_PER_BRIGHT_DATA_SEARCH,
    )) {
      const rawQuery = `${titles.join(', ')} of ${variant}${isNonEmptyString(location) ? ` ${location}` : ''}`;
      const { result } =
        await this.brightDataLudicrousSearchService.searchNaturalLanguage({
          workspaceId,
          entity: 'people',
          rawQuery,
          maxBudgetUsd,
          targetCount: BRIGHT_DATA_CANDIDATES_PER_SEARCH,
        });

      spentUsd += result.spentUsd;

      for (const document of result.documents) {
        const item = mapBrightDataPersonToSearchItem(document);
        const name = typeof item.name === 'string' ? item.name : '';

        if (name === '') {
          continue;
        }

        candidates.push({
          id: document.brightId,
          name,
          title: typeof item.title === 'string' ? item.title : '',
          companyName:
            typeof item.companyName === 'string' ? item.companyName : '',
          linkedinUrl: typeof item.url === 'string' ? item.url : '',
          evidenceText: '',
          source: 'bright_data',
          location: typeof item.location === 'string' ? item.location : '',
          rawProfile: document.data,
        });
      }

      const { verified } = await this.verify({
        candidates,
        variants,
        roles,
        requestedClasses,
      });

      if (verified.length > 0) {
        break;
      }
    }

    return { candidates, spentUsd };
  }

  // The model reads the raw results; if it is unavailable the LinkedIn result
  // titles are split by pattern instead, so a model outage costs accuracy, not
  // the whole Google source
  private async extractPeople({
    company,
    variants,
    roles,
    results,
    workspaceId,
    sourceErrors,
  }: {
    company: string;
    variants: string[];
    roles: string[];
    results: GoogleSerpOrganicItem[];
    workspaceId: string;
    sourceErrors: string[];
  }): Promise<ExtractedPerson[]> {
    if (results.length === 0) {
      return [];
    }

    try {
      return await this.googleResultExtractionService.extract({
        workspaceId,
        company,
        roles,
        results,
      });
    } catch (error) {
      sourceErrors.push(
        `google_extraction: ${this.describe(error)} (read LinkedIn titles by pattern instead)`,
      );

      return results.flatMap((item): ExtractedPerson[] => {
        const person = parseLinkedinSerpResult(item);

        if (person === null) {
          return [];
        }

        // "Name - Company" has no title: the part after the dash is the company
        const titleIsCompany =
          person.companyName === '' &&
          matchesAnyCompanyVariant(variants, person.title) &&
          !roles.some((role) => titleContainsWord(person.title, role));

        return [
          {
            name: person.name,
            jobTitle: titleIsCompany ? '' : person.title,
            companyName: titleIsCompany ? person.title : person.companyName,
            location: '',
            isCurrentRole: true,
            evidence: `${item.title} ${person.snippet}`,
            linkedinUrl: person.linkedinUrl,
            sourceUrl: item.url,
          },
        ];
      });
    }
  }

  // The employer the results state, or, when they state none, the words the
  // person was read from
  private isAtCompany(variants: string[], person: ExtractedPerson): boolean {
    return isNonEmptyString(person.companyName)
      ? matchesAnyCompanyVariant(variants, person.companyName)
      : textMentionsAnyCompanyVariant(variants, person.evidence);
  }

  private toCandidate(person: ExtractedPerson, source: Source): Candidate {
    return {
      id: toId(
        isNonEmptyString(person.linkedinUrl)
          ? normalizeLinkedinProfileUrl(person.linkedinUrl)
          : `${person.name}|${person.companyName}`,
      ),
      name: person.name,
      title: person.jobTitle,
      companyName: person.companyName,
      linkedinUrl: person.linkedinUrl,
      evidenceText: person.evidence,
      source,
      linkedinUrlDerivedFromPost: person.linkedinUrlDerivedFromPost,
    };
  }

  // A Bright Data record already holds the profile; keep it when it has enough
  // to judge a person on, so no second fetch is paid for
  private profileOf(person: VerifiedCandidate): { profile?: RowProfile } {
    if (!isDefined(person.rawProfile)) {
      return {};
    }

    const { profile } = brightDataRecordToPersonOtherFields(person.rawProfile);

    return isDefined(profile) ? { profile } : {};
  }

  private noteOf(verdict: PersonJudgement | undefined): string {
    if (!isDefined(verdict)) {
      return '';
    }

    return [
      verdict.company === 'related' ? verdict.companyNote : '',
      verdict.roleNote,
    ]
      .filter(isNonEmptyString)
      .join(' ');
  }

  // A model rules on every candidate against the company asked about; if it is
  // unavailable the candidates are checked by name matching instead
  private async judgeCandidates({
    workspaceId,
    company,
    alternateNames,
    roles,
    location,
    candidates,
    sourceErrors,
    website,
    industry,
  }: {
    workspaceId: string;
    company: string;
    alternateNames: string[];
    roles: string[];
    location?: string;
    candidates: Candidate[];
    sourceErrors: string[];
    website?: string;
    industry?: string;
  }): Promise<Map<string, PersonJudgement>> {
    const unique = [
      ...new Map(candidates.map((candidate) => [candidate.id, candidate])),
    ].map(([, candidate]) => candidate);

    try {
      return await this.personFitFilterService.judge({
        workspaceId,
        company,
        alternateNames,
        roles,
        location,
        website,
        industry,
        candidates: unique.map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          title: candidate.title,
          company: candidate.companyName,
          location: candidate.location ?? '',
          evidence: candidate.evidenceText,
          profile: candidate.rawProfile,
        })),
      });
    } catch (error) {
      sourceErrors.push(
        `candidate_judge: ${this.describe(error)} (checked by name matching instead)`,
      );

      return new Map();
    }
  }

  // Worth a paid Bright Data lookup only when the company on the result
  // matches by name. A person at a parent or operator is still read by the
  // judge, from the company and title their own result states.
  private worthLookingUp(candidate: Candidate, variants: string[]): boolean {
    return isNonEmptyString(candidate.companyName)
      ? matchesAnyCompanyVariant(variants, candidate.companyName)
      : textMentionsAnyCompanyVariant(variants, candidate.evidenceText);
  }

  // A name with a LinkedIn URL can be contacted, a name alone cannot, so every
  // person found without a profile is chased to one. A person whose profile is
  // not found is still returned, with no URL, rather than dropped.
  private async resolveNamedPeople({
    candidates,
    variants,
  }: {
    candidates: Candidate[];
    variants: string[];
  }): Promise<{
    candidates: Candidate[];
    spentUsd: number;
    errors: string[];
  }> {
    const resolutions = await Promise.all(
      candidates.map((candidate) =>
        this.linkedinProfileResolverService.resolve({
          name: candidate.name,
          // The employer their own results state comes first: a person at a
          // parent or operator is found under that name, not the target's
          companyNames: [candidate.companyName, ...variants],
        }),
      ),
    );

    return {
      spentUsd: resolutions.reduce(
        (total, resolution) => total + resolution.spentUsd,
        0,
      ),
      // Only a name that ended with no profile is reported; a retried failure
      // that then succeeded is not an error
      errors: resolutions.flatMap((resolution) =>
        resolution.profiles.length === 0 ? resolution.errors : [],
      ),
      candidates: candidates.flatMap((candidate, index) => {
        const { profiles } = resolutions[index];

        // No profile: the name is still returned, as a lead without a URL
        if (profiles.length === 0) {
          return [candidate];
        }

        return profiles.map(
          (profile): Candidate => ({
            id: toId(normalizeLinkedinProfileUrl(profile.linkedinUrl)),
            name: candidate.name,
            // What the profile says wins over what a result said
            title: profile.title || candidate.title,
            companyName: profile.companyName,
            linkedinUrl: profile.linkedinUrl,
            evidenceText: [
              candidate.evidenceText,
              profile.evidence !== '' ? `profile: ${profile.evidence}` : '',
              profile.sameNameProfileCount !== null
                ? `${profile.sameNameProfileCount} Bright Data profiles carry exactly this name`
                : '',
            ]
              .filter(isNonEmptyString)
              .join(' | '),
            source: 'web',
            linkedinUrlDerivedFromPost: profile.derivedFromPost,
          }),
        );
      }),
    };
  }

  // Looks the Google-found LinkedIn profiles up in Bright Data (instant mode,
  // several profile URLs per query). A profile it does not know keeps the
  // title and company parsed from the Google result.
  private async enrichGoogleCandidates({
    googleCandidates,
    knownCandidates,
    maxSpendUsd,
  }: {
    googleCandidates: Candidate[];
    knownCandidates: Candidate[];
    maxSpendUsd: number;
  }): Promise<{ candidates: Candidate[]; spentUsd: number }> {
    // Profiles the people search already returned are not paid for twice
    const alreadyKnown = new Set(
      knownCandidates
        .filter((candidate) => isNonEmptyString(candidate.linkedinUrl))
        .map((candidate) => normalizeLinkedinProfileUrl(candidate.linkedinUrl)),
    );
    const urls = googleCandidates
      .map((candidate) => candidate.linkedinUrl)
      .filter(
        (url) =>
          isNonEmptyString(url) &&
          !alreadyKnown.has(normalizeLinkedinProfileUrl(url)),
      );
    const maxRecords = Math.floor(
      maxSpendUsd / BRIGHT_DATA_COST_PER_RECORD_USD,
    );

    if (urls.length === 0 || maxRecords <= 0) {
      return { candidates: googleCandidates, spentUsd: 0 };
    }

    const enrichedByUrl = new Map<string, Candidate>();
    let spentUsd = 0;
    let recordsLeft = maxRecords;
    // Each batch is a separate request, so they can run together
    const batches = await Promise.all(
      packLinkedinUrlLookupQueries(urls.slice(0, maxRecords)).map((batch) =>
        this.brightDataBusinessSearchService
          .search({
            entity: 'people',
            mode: 'instant',
            query: batch.join(' '),
            limit: batch.length,
          })
          .catch(() => null),
      ),
    );

    for (const batch of batches) {
      if (batch === null) {
        continue;
      }

      for (const document of batch.documents) {
        if (recordsLeft <= 0) {
          break;
        }

        recordsLeft -= 1;
        spentUsd += BRIGHT_DATA_COST_PER_RECORD_USD;

        const item = mapBrightDataPersonToSearchItem(document);
        const url = typeof item.url === 'string' ? item.url : '';

        if (url === '') {
          continue;
        }

        enrichedByUrl.set(normalizeLinkedinProfileUrl(url), {
          id: document.brightId,
          name: typeof item.name === 'string' ? item.name : '',
          title: typeof item.title === 'string' ? item.title : '',
          companyName:
            typeof item.companyName === 'string' ? item.companyName : '',
          linkedinUrl: url,
          evidenceText: '',
          source: 'google',
          location: typeof item.location === 'string' ? item.location : '',
          rawProfile: document.data,
        });
      }
    }

    return {
      spentUsd,
      candidates: googleCandidates.map((candidate) => {
        const enriched = enrichedByUrl.get(
          normalizeLinkedinProfileUrl(candidate.linkedinUrl),
        );

        if (!isDefined(enriched)) {
          return candidate;
        }

        return {
          ...candidate,
          name: enriched.name || candidate.name,
          title: enriched.title || candidate.title,
          // An empty company means the profile has none to check against, so
          // the Google text stays the evidence
          companyName: enriched.companyName || candidate.companyName,
          location: enriched.location,
          rawProfile: enriched.rawProfile,
        };
      }),
    };
  }

  private async verify({
    candidates,
    variants,
    roles,
    requestedClasses,
    verdicts = new Map<string, PersonJudgement>(),
  }: {
    candidates: Candidate[];
    variants: string[];
    roles: string[];
    requestedClasses: TitleClass[];
    verdicts?: Map<string, PersonJudgement>;
  }): Promise<{
    verified: VerifiedCandidate[];
    rejected: RejectedCandidate[];
  }> {
    const byKey = new Map<string, VerifiedCandidate>();
    const rejected: RejectedCandidate[] = [];
    // One taxonomy call for every title seen at this company; null means the
    // service is down and the roles as typed are all there is to compare with
    const titleClasses = await this.titleExpansionService.classifyTitles(
      candidates.map((candidate) => candidate.title),
    );

    for (const candidate of candidates) {
      const verdict = verdicts.get(candidate.id);
      // The judge's reading comes first. Where it has none, or cannot tell the
      // company ("unknown"), the names are matched as text: a result with no
      // company in its title is checked against the words it was read from.
      const companyMatches =
        isDefined(verdict) && verdict.company !== 'unknown'
          ? verdict.company === 'same' || verdict.company === 'related'
          : matchesAnyCompanyVariant(variants, candidate.companyName) ||
            (candidate.companyName === '' &&
              textMentionsAnyCompanyVariant(variants, candidate.evidenceText));
      const roleScore = isDefined(verdict)
        ? ({ exact: 2, related: 1, none: 0 } as const)[verdict.role]
        : scoreRoleMatch({
            title: candidate.title,
            roles,
            requestedClasses,
            candidateClass:
              titleClasses?.get(candidate.title.trim().toLowerCase()) ?? null,
          });

      if (!companyMatches || roleScore === 0) {
        rejected.push({
          name: candidate.name,
          title: candidate.title,
          companyOnProfile: candidate.companyName,
          reason: companyMatches ? 'role_mismatch' : 'company_mismatch',
          ...(isDefined(verdict) && {
            note: companyMatches ? verdict.roleNote : verdict.companyNote,
          }),
        });
        continue;
      }

      const key = isNonEmptyString(candidate.linkedinUrl)
        ? normalizeLinkedinProfileUrl(candidate.linkedinUrl)
        : `${candidate.name.toLowerCase()}|${candidate.companyName.toLowerCase()}`;
      // One person read twice, once with a profile URL and once without, under
      // a one-letter spelling slip
      const existing =
        byKey.get(key) ??
        [...byKey.values()].find(
          (other) =>
            (!isNonEmptyString(other.linkedinUrl) ||
              !isNonEmptyString(candidate.linkedinUrl)) &&
            personNamesRoughlyMatch(other.name, candidate.name),
        );

      if (isDefined(existing)) {
        if (
          !isNonEmptyString(existing.linkedinUrl) &&
          isNonEmptyString(candidate.linkedinUrl)
        ) {
          existing.linkedinUrl = candidate.linkedinUrl;
          existing.name = candidate.name;
        }

        if (!existing.sources.includes(candidate.source)) {
          existing.sources.push(candidate.source);
        }

        continue;
      }

      byKey.set(key, {
        ...candidate,
        sources: [candidate.source],
        roleScore,
        verdict,
      });
    }

    const verified = [...byKey.values()].sort(
      (first, second) =>
        second.roleScore - first.roleScore ||
        // The company asked about before one linked to it
        Number(second.verdict?.company !== 'related') -
          Number(first.verdict?.company !== 'related') ||
        second.sources.length - first.sources.length ||
        getRequestedRoleOrder(first.title, roles) -
          getRequestedRoleOrder(second.title, roles),
    );

    return {
      verified,
      // A person can be rejected on one record and verified on another (a
      // profile with no title, then the same person on a page that gives it)
      rejected: rejected.filter(
        (entry) =>
          !verified.some((person) => personNamesMatch(person.name, entry.name)),
      ),
    };
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
