import { Injectable, Logger, Optional } from '@nestjs/common';

import { createHash } from 'crypto';

import { isNonEmptyString } from '@sniptt/guards';

import { isDefined } from 'twenty-shared/utils';

import { withProviderCallContext } from 'src/engine/core-modules/provider-call-log/storage/provider-call-context.storage';
import { BrightDataLudicrousSearchService } from 'src/engine/core-modules/bright-data/services/ludicrous/bright-data-ludicrous-search.service';

import { BrightDataBusinessSearchService } from 'src/engine/core-modules/bright-data/services/bright-data-business-search.service';
import { HarvestLinkedinService } from 'src/engine/core-modules/org-chart/services/harvest-linkedin.service';
import {
  buildHarvestSearchQuery,
  HARVEST_COST_PER_RECORD_USD,
} from 'src/engine/core-modules/org-chart/utils/harvest-search-params.util';

import { BRIGHT_DATA_COST_PER_RECORD_USD } from 'src/engine/core-modules/bright-data/ludicrous/constants/bright-data-ludicrous-pricing.const';

import { mapBrightDataPersonToSearchItem } from 'src/engine/core-modules/bright-data/utils/bright-data-business-search.util';

import {
  isOpaqueLinkedinId,
  linkedinUrlsAreComparable,
} from 'src/engine/core-modules/outreach-command/utils/person-identity.util';

import {
  matchesAnyCompanyVariant,
  textMentionsAnyCompanyVariant,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/company-name-variants.util';

import {
  FindPeopleGoogleSearchService,
  type GoogleCompanySearchResult,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/find-people-google-search.service';

import {
  FindPeopleSerpSourcesService,
  type SerpSourcePeople,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/find-people-serp-sources.service';

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
  closestRequestedRole,
  isLeadershipCandidateTitle,
  scoreRoleMatch,
  titleContainsWord,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/role-title-matching.util';

import { type TitleClass } from 'src/engine/core-modules/title-taxonomy/title-class.type';

import {
  TitleExpansionService,
  type ResolvedRoles,
} from 'src/engine/core-modules/title-taxonomy/title-expansion.service';
import { expandRoleWithFamilyFallback } from 'src/engine/core-modules/title-taxonomy/title-family-fallback.util';
import {
  buildRoleSearches,
  cellStage,
  tieredSearchesOf,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/role-search-plan.util';
import {
  buildCompanyIdentity,
  identityVariants,
  type CompanyIdentity,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/company-identity.util';
import {
  buildBrightDataCellQueries,
  buildHarvestCellParameters,
  buildSerpCellQueries,
  identityCountryCodes,
  harvestParametersHaveCompany,
  type QueryCell,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/search-params.util';
import { resolveSalesNavFilters } from 'src/engine/core-modules/candidate-search/constants/taxonomy-platform-maps';
import {
  resolveHarvestFunctionIdForRoot,
  resolveHarvestIndustryIds,
  resolveHarvestSeniorityLevelIds,
} from 'src/engine/core-modules/candidate-search/constants/harvest-filter-ids';
import { CompanyNameResolverService } from 'src/engine/core-modules/org-chart/services/company-name-resolver.service';

import {
  BrightDataPersonFitFilterService,
  type PersonJudgement,
} from 'src/engine/core-modules/bright-data/services/bright-data-person-fit-filter.service';

import { brightDataRecordToPersonOtherFields } from 'src/engine/core-modules/candidate-sourcing/services/profile-fetch/bright-data-person-row-fields.util';

import { type RowProfile } from 'src/engine/core-modules/candidate-sourcing/services/profile-fetch/profile-row-fields.util';
import { type DeprioritisationReason } from 'src/engine/core-modules/outreach-command/utils/outreach-people-deprioritisation.util';
import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import {
  type FindPeopleNoneFoundReason,
  type FindPeopleRung,
  type FindPeopleTerminalState,
  pairKeyOf,
} from 'src/engine/core-modules/outreach-command/utils/outreach-people-found.util';
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
  type FindPeopleRoleState,
  type CompanyOutcome,
  type FindPeopleByCompanyTarget,
  type RejectedCandidate,
  type ResolvedInput,
  type RoleMatch,
  type Source,
  type VerifiedCandidate,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/find-people-by-company.types';

// Bright Data's SERP limit is 1,000 requests/min on an unfunded account and
// higher once funded (docs.brightdata.com/general/usage-monitoring/serp-rate-limit);
// a company sends about 5 queries, so 50 at a time stays inside it
const DEFAULT_COMPANY_CONCURRENCY = 50;
// A run that admits every company at once finishes in one burst: the rows all
// reach the People tab within a few seconds of each other, at the end, so the
// tab fills in a single paint instead of row by row. Spacing the starts keeps
// the lookups overlapping (the run is barely longer) while rows arrive a few
// seconds apart.
const DEFAULT_COMPANY_STAGGER_MS = 2_500;
// The whole spread, so a long list does not pay the stagger on every company
// and hold a background chunk's queue slot for minutes
const MAX_COMPANY_STAGGER_WINDOW_MS = 30_000;
// A lookup that could not complete (source_error) is run again before the
// model sees it, so a blip or a laptop wake-up does not cost a model round
const DEFAULT_COMPANY_LOOKUP_RETRIES = 2;
const COMPANY_RETRY_BACKOFF_MS = [5_000, 15_000];
// The resolved company carries its own spellings; a filter rarely needs more
// than the canonical name and one legal name, and every extra term costs
// precision on a bag-of-words field
const MAX_COMPANY_NAMES_PER_SEARCH = 2;
const BRIGHT_DATA_CANDIDATES_PER_SEARCH = 5;
// Harvest bills $0.004 a record; five is a $0.02 step, not the whole pair cap
const HARVEST_CANDIDATES_PER_SEARCH = 5;
const MIN_PEOPLE_PER_COMPANY = 3;
const MAX_PEOPLE_PER_ROLE = 3;
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

const isSource = (value: string): value is Source =>
  value === 'bright_data' ||
  value === 'google' ||
  value === 'web' ||
  value === 'harvest';

// The best few people for each requested role, in rank order. One company-wide
// slice let a role with many holders push every other role's people off the
// row (five supply chain heads left no place for the procurement head). A
// person serving two roles is kept once.
export const selectPeoplePerRole = <
  TPerson extends { roleMatches?: RoleMatch[] },
>(
  ranked: TPerson[],
  roles: string[],
): TPerson[] => {
  const kept = new Set<TPerson>();

  for (const role of roles) {
    ranked
      .filter((person) =>
        (person.roleMatches ?? []).some((match) => match.role === role),
      )
      .slice(0, MAX_PEOPLE_PER_ROLE)
      .forEach((person) => kept.add(person));
  }

  // A person the role matcher tied to no requested role still fills the row up
  // to the old minimum
  for (const person of ranked) {
    if (kept.size >= MIN_PEOPLE_PER_COMPANY) {
      break;
    }

    kept.add(person);
  }

  return ranked.filter((person) => kept.has(person));
};

// The function words a role is about, e.g. "engineering" from "VP Engineering",
// widened with the role's curated family ("technology", "cto", "works", "unit")
const functionWordsOf = (roles: string[]): string[] => [
  ...new Set(
    roles
      .flatMap((role) => expandRoleWithFamilyFallback(role))
      .flatMap((title) => title.toLowerCase().split(/[^a-z]+/))
      .filter((word) => word.length >= 4 && !ROLE_FILLER_WORDS.has(word))
      .map((word) => word.slice(0, Math.max(4, word.length - 2))),
  ),
];

// True when the title or the profile says the person runs the function asked
// for. The owner of a small company counts only when they do.
const leadsRequestedFunction = (
  person: { title: string; rawProfile?: unknown },
  roles: string[],
  { includeAbout = false }: { includeAbout?: boolean } = {},
): boolean => {
  const words = functionWordsOf(roles);

  if (words.length === 0) {
    return true;
  }

  // Titles and the about line only: a degree in "engineering" is not a job
  const profile = isDefined(person.rawProfile)
    ? (person.rawProfile as Record<string, unknown>)
    : {};
  const experience = Array.isArray(profile.experience)
    ? profile.experience.map((entry) =>
        typeof entry === 'object' && entry !== null
          ? `${String((entry as Record<string, unknown>).title ?? '')} ${String((entry as Record<string, unknown>).company ?? '')}`
          : '',
      )
    : [];
  const text = [
    person.title,
    ...(includeAbout && typeof profile.about === 'string'
      ? [profile.about.slice(0, 400)]
      : []),
    ...experience.slice(0, 6),
  ]
    .join(' ')
    .toLowerCase();

  return words.some((word) => text.includes(word));
};
// Words that say nothing about the function a role covers
const ROLE_FILLER_WORDS = new Set([
  'vice',
  'president',
  'head',
  'director',
  'chief',
  'officer',
  'senior',
  'lead',
  'leader',
  'manager',
  'managing',
  'general',
  'gm',
  'the',
  'and',
  'for',
  'all',
]);
const MAX_EVIDENCE_SNIPPET_LENGTH = 300;

export const getCompanyConcurrency = (): number => {
  const configured = Number(process.env.FIND_ROLE_COMPANY_CONCURRENCY);

  return Number.isInteger(configured) && configured > 0
    ? configured
    : DEFAULT_COMPANY_CONCURRENCY;
};

// How long to wait between starting one company and the next. A single
// company has nothing to spread, and an empty variable means "unset" rather
// than the 0 that `Number('')` would give, so 0 stays an explicit opt-out.
export const getCompanyStaggerMs = (companyCount: number): number => {
  const configured = process.env.FIND_ROLE_COMPANY_STAGGER_MS;
  const parsed =
    isNonEmptyString(configured) && Number.isFinite(Number(configured))
      ? Number(configured)
      : NaN;

  const staggerMs = Number.isFinite(parsed)
    ? Math.max(parsed, 0)
    : DEFAULT_COMPANY_STAGGER_MS;

  if (staggerMs === 0 || companyCount <= 1) {
    return 0;
  }

  return (
    Math.min(staggerMs * (companyCount - 1), MAX_COMPANY_STAGGER_WINDOW_MS) /
    (companyCount - 1)
  );
};

// Company + titles is the primary GTM. An industry filter on a search that is
// already anchored to one company cannot add recall: it can only drop rows
// where LinkedIn's industry label for that employer differs from ours. So it
// is opt-in, and a run can measure it before it is turned on by default.
const shouldSendIndustryToQueries = (identity: CompanyIdentity): boolean => {
  const flag = process.env.FIND_PEOPLE_SEND_INDUSTRY?.trim().toLowerCase();
  const enabled = flag === 'true' || flag === '1' || flag === 'yes';

  return enabled && isNonEmptyString(identity.industry);
};

const getCompanyLookupRetries = (): number => {
  const configured = Number(process.env.FIND_ROLE_COMPANY_LOOKUP_RETRIES);

  return Number.isInteger(configured) && configured >= 0
    ? configured
    : DEFAULT_COMPANY_LOOKUP_RETRIES;
};

const EMPTY_GOOGLE_RESULT: GoogleCompanySearchResult = {
  results: [],
  aiOverviewTexts: [],
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

// Two searches per company (brand and legal name) would double the paid calls
// in flight; this keeps the same ceiling the company concurrency had before
let activeBrightDataSearches = 0;
const waitingBrightDataSearches: Array<() => void> = [];

const withBrightDataPeopleSlot = async <TResult>(
  task: () => Promise<TResult>,
): Promise<TResult> => {
  if (activeBrightDataSearches >= getCompanyConcurrency()) {
    await new Promise<void>((resolve) =>
      waitingBrightDataSearches.push(resolve),
    );
  } else {
    activeBrightDataSearches += 1;
  }

  try {
    return await task();
  } finally {
    const next = waitingBrightDataSearches.shift();

    if (isDefined(next)) {
      next();
    } else {
      activeBrightDataSearches -= 1;
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
    // Optional: a workspace without Harvest keys simply skips the last step
    @Optional()
    private readonly harvestLinkedinService?: HarvestLinkedinService,
    // Optional: TheOrg / The Official Board are asked only where they are
    // wired and switched on, and are skipped like Harvest otherwise
    @Optional()
    private readonly serpSourcesService?: FindPeopleSerpSourcesService,
    // Optional: the company index. When it answers, one canonical name, its
    // market, its industry and its LinkedIn URL are resolved once per company
    // and handed to every source; without it the caller's own name spellings
    // are used, which is what every source did before.
    @Optional()
    private readonly companyNameResolverService?: CompanyNameResolverService,
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
    // rerunFound is the "redo the search" switch: answering it from the cache
    // handed back the previous run's rows, so a re-run with new code, a new
    // source or a new title list could never surface anybody new
    const useCache =
      !input.plan.confidential && !input.rerunFound && isDefined(this.cache);

    if (useCache) {
      const cached = await this.cache
        ?.get<CompanyOutcome>(cacheKey)
        .catch(() => undefined);

      if (isDefined(cached) && cached.terminalState === 'found') {
        return {
          ...cached,
          spentUsd: 0,
          sourcesUsed: ['cache'],
          sourcesAttempted: ['cache'],
        };
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
      // A small company's owner only stands in for the role when they run that
      // function: a founder CEO at a fintech is not the VP of Engineering
      const ownersLeadsFunction = owners.people.filter((person) =>
        leadsRequestedFunction(person, input.roles, { includeAbout: true }),
      );

      outcome =
        ownersLeadsFunction.length > 0
          ? {
              ...owners,
              people: ownersLeadsFunction,
              spentUsd,
              sourcesUsed: [
                ...new Set([...outcome.sourcesUsed, ...owners.sourcesUsed]),
              ],
              sourcesAttempted: [
                ...new Set([
                  ...(outcome.sourcesAttempted ?? []),
                  ...(owners.sourcesAttempted ?? []),
                ]),
              ],
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
        withProviderCallContext({ subject: company.name }, () =>
          this.lookupCompany(
            company,
            input,
            resolvedRoles,
            workspaceId,
            options,
          ),
        ),
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
          sourcesAttempted: [],
          titlesTried: [],
          roleStates: [],
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

  // The company's identity, resolved once and shared by every source. The
  // index is the only thing that knows the canonical spelling, the market and
  // the LinkedIn company, so a failure there falls back to the caller's own
  // spellings instead of failing the lookup: an unresolved name still
  // searches, it just searches less well.
  private async resolveCompanyIdentity(
    company: FindPeopleByCompanyTarget,
  ): Promise<CompanyIdentity> {
    const resolver = this.companyNameResolverService;

    if (!isDefined(resolver)) {
      return buildCompanyIdentity({ target: company });
    }

    const resolved = await resolver
      .resolveFromRawCompanyName(company.name)
      .catch((error) => {
        this.logger.warn(
          `find_people_by_company "${company.name}": company index lookup failed: ${this.describe(error)}`,
        );

        return null;
      });

    return buildCompanyIdentity({ target: company, resolved });
  }

  // The queries the caller wrote for this company and this source. A query
  // that names no company belongs to the first company only, so a multi-company
  // call does not send one agent query N times.
  private directQueriesFor({
    company,
    identity,
    input,
    source,
  }: {
    company: FindPeopleByCompanyTarget;
    identity: CompanyIdentity;
    input: ResolvedInput;
    source: 'google' | 'bright_data' | 'harvest';
  }): Array<{ query: string; role?: string }> {
    const queries = input.queries ?? [];

    if (queries.length === 0) {
      return [];
    }

    const isFirstCompany = input.companies[0]?.name === company.name;

    return queries
      .filter((entry) => entry.source === source)
      .filter((entry) => {
        if (!isNonEmptyString(entry.company)) {
          return isFirstCompany;
        }

        const wanted = entry.company.trim().toLowerCase();

        return identity.aliases.some((alias) => {
          const lowered = alias.toLowerCase();

          return lowered.includes(wanted) || wanted.includes(lowered);
        });
      })
      .map((entry) => ({
        query: entry.query.trim(),
        ...(isNonEmptyString(entry.role) && { role: entry.role.trim() }),
      }))
      .filter((entry) => entry.query !== '');
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
    const identity = await this.resolveCompanyIdentity(company);
    const variants = identityVariants(identity);
    const titles = resolvedRoles.searchTitles.slice(0, MAX_TITLES_IN_QUERY);
    const query = `${titles.join(', ')} at ${identity.canonicalName}`;
    const sourceErrors: string[] = [];
    // What actually put a kept person on the row. What was *asked* is kept
    // apart: a source that ran and returned nobody is not a source that worked,
    // and the ledger should not read it as one.
    const sourcesAttempted: Source[] = [];
    let spentUsd = 0;
    let budgetExhausted = false;
    // Where the time went, so a slow run can be traced to a stage
    const stageMilliseconds: Record<string, number> = {};
    const startedAt = Date.now();
    const timed = async <TResult>(
      stage: string,
      task: () => Promise<TResult>,
    ): Promise<TResult> => {
      const stageStartedAt = Date.now();

      try {
        // Every provider request inside the stage is logged under it
        return await withProviderCallContext({ stage }, task);
      } finally {
        stageMilliseconds[stage] = Date.now() - stageStartedAt;
      }
    };
    // One search per role class: the per-pair cap is per company x role, so a
    // four-role company may spend four caps, and one class serving two roles
    // gets both
    const roleSearches = buildRoleSearches(resolvedRoles, input.roles);
    const companyBudgetUsd =
      input.plan.perPairUsd * Math.max(roleSearches.length, 1);
    const budgetLeft = () => companyBudgetUsd - spentUsd;
    const alternateNames = company.alternateNames ?? [];

    const brightDataCandidates: { candidates: Candidate[]; spentUsd: number } =
      {
        candidates: [],
        spentUsd: 0,
      };

    if (input.sources.includes('bright_data')) {
      sourcesAttempted.push('bright_data');

      for (const search of roleSearches) {
        // A lower tier is asked only when the one above found nobody
        const tiers = tieredSearchesOf(search);

        for (const { titles: tierTitles, tier } of tiers) {
          if (budgetLeft() <= 0) {
            budgetExhausted = true;
            break;
          }

          const shareUsd = Math.min(
            input.plan.perPairUsd * Math.max(search.roles.length, 1),
            budgetLeft(),
          );
          let found = 0;

          try {
            const result = await timed(
              cellStage({ familyKey: search.key, source: 'bright_data', tier }),
              () =>
                this.searchBrightData({
                  identity,
                  cell: search,
                  titles: tierTitles,
                  location: input.location,
                  maxBudgetUsd: shareUsd,
                  workspaceId,
                  titleExpression: search.titleExpression ?? undefined,
                }),
            );

            brightDataCandidates.spentUsd += result.spentUsd;
            spentUsd += result.spentUsd;
            found = result.candidates.length;

            for (const candidate of result.candidates) {
              candidate.query =
                search.titleExpression ??
                `${tierTitles.join(', ')} at ${identity.canonicalName}`;
              candidate.queriedRole = search.roles[0];

              brightDataCandidates.candidates.push(candidate);
            }
          } catch (error) {
            sourceErrors.push(`bright_data: ${this.describe(error)}`);
          }

          if (found > 0) {
            break;
          }
        }
      }
    }

    // Queries the caller wrote for Bright Data, run as instant searches: they
    // are usually a name or an exact phrase, which is what instant is good at,
    // and they skip the planner they do not need
    const directBrightData = this.directQueriesFor({
      company,
      identity,
      input,
      source: 'bright_data',
    });

    for (const direct of directBrightData) {
      try {
        const result = await timed(
          `direct:bright_data:${direct.query.slice(0, 40)}`,
          () =>
            this.brightDataBusinessSearchService.search({
              entity: 'people',
              mode: 'instant',
              query: direct.query,
              limit: BRIGHT_DATA_CANDIDATES_PER_SEARCH,
              workspaceId,
            }),
        );

        spentUsd += result.costUsd;

        for (const document of result.documents) {
          const item = mapBrightDataPersonToSearchItem(document);
          const name = typeof item.name === 'string' ? item.name : '';

          if (name === '') {
            continue;
          }

          brightDataCandidates.candidates.push({
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
            query: `direct:${direct.query}`,
            queriedRole: direct.role ?? input.roles[0],
          });
        }
      } catch (error) {
        sourceErrors.push(`direct:bright_data: ${this.describe(error)}`);
      }
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
              criteria: input.plan.criteria,
            }),
          )
        : new Map<string, PersonJudgement>();
    let { verified, rejected } = await this.verify({
      candidates,
      variants,
      roles: input.roles,
      requestedClasses: resolvedRoles.requestedClasses,
      roleClasses: resolvedRoles.roleClasses,
      verdicts,
    });
    ({ verified, rejected } = this.splitByCriteria(verified, rejected));
    const confidentEnough = (people: VerifiedCandidate[]): boolean =>
      people.some(
        (person) =>
          person.roleScore === 2 &&
          meetsConfidence(
            this.confidenceOfCandidate(person, input.plan.freshnessDays),
            input.plan.minConfidence,
          ),
      );
    // FIND_ROLE_GOOGLE_TRIGGER=no_person asks Google only when Bright Data put
    // nobody forward; the default keeps the confidence rule and the recall it
    // buys at small companies
    // A redo (rerunFound) asks every chosen source: stopping at the first
    // confident one meant a re-run never reached the source that had found
    // the other holders last time
    const askEverySource = input.rerunFound === true;
    const googleWorthAsking =
      askEverySource ||
      (process.env.FIND_ROLE_GOOGLE_TRIGGER === 'no_person'
        ? verified.length === 0
        : !confidentEnough(verified));

    if (input.sources.includes('google') && googleWorthAsking) {
      if (budgetLeft() <= 0) {
        budgetExhausted = true;
      } else {
        sourcesAttempted.push('google');

        // One plain and one boolean query per role family, so a second role
        // gets its own query instead of sharing one blended set
        const families = roleSearches.map((search) => {
          const cellQueries = buildSerpCellQueries({
            identity,
            cell: search,
            location: input.location,
          });

          return {
            key: search.key,
            plain: cellQueries.plain,
            boolean: cellQueries.boolean,
          };
        });
        // TheOrg and The Official Board publish a company's leadership as
        // structured people, so they are asked beside the Google queries, not
        // through them: the pair waits no longer than the slower of the two
        const [google, serpSources] = await Promise.all([
          timed(cellStage({ familyKey: 'all', source: 'google' }), () =>
            this.googleSearchService
              .searchCompany({
                variants,
                titles,
                roles: input.roles,
                // Google gets the clause trimmed to its own word budget; a
                // >30-word root clause used to be dropped outright
                titleExpressions:
                  resolvedRoles.googleTitleExpressions ??
                  resolvedRoles.titleExpressions,
                location: input.location,
                domain: company.domain ?? identity.domain,
                families,
              })
              .then((result) => {
                sourceErrors.push(
                  ...result.errors.map((error) => `google: ${error}`),
                );

                return result;
              })
              .catch((error) => {
                sourceErrors.push(`google: ${this.describe(error)}`);

                return EMPTY_GOOGLE_RESULT;
              }),
          ),
          timed(cellStage({ familyKey: 'all', source: 'serp_sources' }), () =>
            this.searchSerpSources({ company, variants }),
          ),
        ]);
        sourceErrors.push(...serpSources.errors);

        // Queries the caller wrote, added to the same result set so they are
        // extracted, judged and checked exactly like a generated one
        const directGoogle = this.directQueriesFor({
          company,
          identity,
          input,
          source: 'google',
        });
        const directGoogleResult =
          directGoogle.length > 0
            ? await timed('direct:google', () =>
                this.googleSearchService.searchDirectQueries(
                  directGoogle.map((entry) => entry.query),
                  input.location,
                ),
              )
            : { results: [], errors: [] };

        sourceErrors.push(
          ...directGoogleResult.errors.map(
            (error) => `direct:google: ${error}`,
          ),
        );

        // The model reads the raw Google results into name, job title,
        // company and profile; what comes after only enriches and checks them
        const extracted = await timed('extract', () =>
          this.extractPeople({
            company: company.name,
            variants,
            roles: input.roles,
            results: [...directGoogleResult.results, ...google.results],
            aiOverviewTexts: google.aiOverviewTexts,
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
          // Already name + title at the company, so they skip the reading step
          // and go straight to the judge with the rest
          ...serpSources.candidates,
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
                  criteria: input.plan.criteria,
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
          roleClasses: resolvedRoles.roleClasses,
          verdicts,
        }));
        ({ verified, rejected } = this.splitByCriteria(verified, rejected));
      }
    }

    // Harvest is last: it is paid and slower (Sales Navigator filters on
    // Harvest's own accounts), so it runs only when the cheaper sources left
    // nobody at the plan's confidence, or on a redo.
    if (
      input.sources.includes('harvest') &&
      (askEverySource || !confidentEnough(verified)) &&
      budgetLeft() >= HARVEST_COST_PER_RECORD_USD
    ) {
      if (!isDefined(this.harvestLinkedinService)) {
        sourceErrors.push('harvest: Harvest is not available in this server');
      } else if (!this.harvestLinkedinService.isConfigured()) {
        sourceErrors.push('harvest: HARVEST_API_KEY is not set');
      } else {
        sourcesAttempted.push('harvest');
        const harvestService = this.harvestLinkedinService;
        const harvestCompanyLinkedinUrl = await this.resolveHarvestCompanyUrl(
          harvestService,
          identity,
        );

        // One lead search per role class, like Bright Data: the merged
        // boolean represented only the first class
        const harvest: {
          candidates: Candidate[];
          spentUsd: number;
          errors: string[];
        } = { candidates: [], spentUsd: 0, errors: [] };

        for (const search of roleSearches) {
          const tiers = tieredSearchesOf(search);

          for (const { titles: tierTitles, tier } of tiers) {
            if (budgetLeft() < HARVEST_COST_PER_RECORD_USD) {
              budgetExhausted = true;
              break;
            }

            const shareUsd = Math.min(
              input.plan.perPairUsd * Math.max(search.roles.length, 1),
              budgetLeft(),
            );
            const result = await timed(
              cellStage({ familyKey: search.key, source: 'harvest', tier }),
              () =>
                this.searchHarvest({
                  identity,
                  cell: search,
                  titles: tierTitles,
                  location: input.location,
                  maxBudgetUsd: shareUsd,
                  companyLinkedinUrl: harvestCompanyLinkedinUrl,
                }).catch((error) => {
                  sourceErrors.push(`harvest: ${this.describe(error)}`);

                  return {
                    candidates: [] as Candidate[],
                    spentUsd: 0,
                    errors: [] as string[],
                  };
                }),
            );

            harvest.spentUsd += result.spentUsd;
            spentUsd += result.spentUsd;
            harvest.errors.push(...result.errors);

            for (const candidate of result.candidates) {
              candidate.query =
                search.titleExpression ??
                `${tierTitles.join(', ')} at ${company.name}`;
              candidate.queriedRole = search.roles[0];

              harvest.candidates.push(candidate);
            }

            if (result.candidates.length > 0) {
              break;
            }
          }
        }

        sourceErrors.push(...harvest.errors);

        // Queries the caller wrote for Sales Navigator, sent on the keyword
        // field beside the company filter. This is where a factored boolean
        // the generators did not produce gets through.
        const directHarvest = this.directQueriesFor({
          company,
          identity,
          input,
          source: 'harvest',
        });
        // Resolved once per company: every direct query shares the location,
        // and the lookup is cached by the service anyway
        const directGeoIds =
          directHarvest.length > 0
            ? await harvestService.resolveGeoIds(input.location ?? '')
            : [];

        for (const direct of directHarvest) {
          const directParameters = buildHarvestCellParameters({
            identity,
            cell: {
              key: 'direct',
              roles: [direct.role ?? input.roles[0] ?? ''],
              titles: [],
              titleExpression: `(${direct.query})`,
            },
            location: input.location,
            geoIds: directGeoIds,
            ...(harvestCompanyLinkedinUrl !== null && {
              companyLinkedinUrl: harvestCompanyLinkedinUrl,
            }),
          });
          const { query: directQuery, ignored: directIgnored } =
            buildHarvestSearchQuery('leads', directParameters);

          if (directIgnored.length > 0) {
            sourceErrors.push(
              `direct:harvest: unsupported parameters: ${directIgnored.join(', ')}`,
            );
          }

          if (!harvestParametersHaveCompany(directQuery)) {
            sourceErrors.push(
              'direct:harvest: no company filter, so the query was not sent',
            );

            continue;
          }

          try {
            const result = await timed(
              `direct:harvest:${direct.query.slice(0, 40)}`,
              () =>
                harvestService.searchSalesNavigatorCollection({
                  kind: 'leads',
                  query: directQuery,
                  limit: HARVEST_CANDIDATES_PER_SEARCH,
                }),
            );

            for (const item of result.items) {
              const candidate = this.toHarvestCandidate(item);

              if (candidate === null) {
                continue;
              }

              candidate.query = `direct:${direct.query}`;
              candidate.queriedRole = direct.role ?? input.roles[0];

              harvest.candidates.push(candidate);
            }
          } catch (error) {
            sourceErrors.push(`direct:harvest: ${this.describe(error)}`);
          }
        }

        if (harvest.candidates.length > 0) {
          const harvestVerdicts = await timed('judge', () =>
            this.judgeCandidates({
              workspaceId,
              company: company.name,
              alternateNames,
              roles: input.roles,
              location: input.location,
              candidates: harvest.candidates,
              sourceErrors,
              website: company.domain,
              industry: company.industry,
              criteria: input.plan.criteria,
            }),
          );

          verdicts = new Map([...verdicts, ...harvestVerdicts]);
          candidates = [...candidates, ...harvest.candidates];
          ({ verified, rejected } = await this.verify({
            candidates,
            variants,
            roles: input.roles,
            requestedClasses: resolvedRoles.requestedClasses,
            roleClasses: resolvedRoles.roleClasses,
            verdicts,
          }));
          ({ verified, rejected } = this.splitByCriteria(verified, rejected));
        }
      }
    }

    const peopleInRole = (await this.mergeDuplicates(verified, workspaceId))
      // A rung-3 keep is a nearby role, but it must still be about the same
      // work: the judge calls a chief product officer "related" to a VP of
      // engineering, and that is not the person the user asked for
      .filter(
        (person) =>
          person.roleScore === 2 ||
          ownerPass ||
          leadsRequestedFunction(person, input.roles),
      );
    const topPeople = selectPeoplePerRole(peopleInRole, input.roles);
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
        roleMatches: person.roleMatches,
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
        ...((person.verdict?.criteria ?? []).length > 0 && {
          criteria: person.verdict?.criteria,
        }),
        ...((person.verdict?.criteria ?? []).some(
          (criterion) => criterion.verdict === 'unknown',
        ) && { criteriaUnknown: true }),
        confidence: this.confidenceOfCandidate(
          person,
          input.plan.freshnessDays,
        ),
        freshness,
        // The query that returned this person, not the merged list: a fan-out
        // across roles must stay attributable per row
        evidence: this.evidenceOf(person, person.query ?? query, retrievedAt),
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
      `find_people_by_company "${company.name}": ${terminalState}${reason ? ` (${reason})` : ''}, ${verified.length} verified, ${rejected.length} rejected, sources ${sourcesAttempted.join(' > ') || 'none'}, $${spentUsd.toFixed(3)}`,
    );

    const sourcesUsed = [
      ...new Set(kept.flatMap((person) => person.sources.filter(isSource))),
    ];
    const roleStates = this.roleStatesOf({
      roles: input.roles,
      people: kept,
      terminalState,
      reason,
      rejectedCount: rejected.length,
    });

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
      sourcesAttempted: [...new Set(sourcesAttempted)],
      titlesTried: titles,
      roleStates,
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
    const evidence: FindPeopleEvidence[] = [];

    // A person listed on TheOrg or The Official Board names that page first,
    // even though the pair counts them under the SERP source: the result keeps
    // one evidence entry, and it must be the one that says where they came from
    if (isDefined(person.provider)) {
      evidence.push({
        source: person.provider,
        query: person.companyName,
        retrievedAt,
        snippet: person.evidenceText.slice(0, MAX_EVIDENCE_SNIPPET_LENGTH),
        ...(isNonEmptyString(person.linkedinUrl) && {
          url: person.linkedinUrl,
        }),
      });
    }

    evidence.push(
      ...person.sources.map((source) => ({
        source,
        query,
        retrievedAt,
        snippet:
          source === 'bright_data' || !isNonEmptyString(person.evidenceText)
            ? `${person.title} at ${person.companyName}`.trim()
            : person.evidenceText.slice(0, MAX_EVIDENCE_SNIPPET_LENGTH),
        ...(isNonEmptyString(person.linkedinUrl) && {
          url: person.linkedinUrl,
        }),
      })),
    );

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
      kept.roleMatches = [
        ...new Map(
          [...(kept.roleMatches ?? []), ...(duplicate.roleMatches ?? [])].map(
            (match) => [match.role, match],
          ),
        ).values(),
      ];
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

  // TheOrg and The Official Board are SERP-side sources: they run only while
  // the pair is asking Google, behind their own flags, and a provider that is
  // slow or breaks is reported without costing the other
  private async searchSerpSources({
    company,
    variants,
  }: {
    company: FindPeopleByCompanyTarget;
    variants: string[];
  }): Promise<SerpSourcePeople> {
    if (
      !isDefined(this.serpSourcesService) ||
      !this.serpSourcesService.isEnabled()
    ) {
      return { candidates: [], errors: [] };
    }

    return this.serpSourcesService
      .fetchPeople({
        companyName: company.name,
        alternateNames: variants.slice(1),
      })
      .catch((error) => ({
        candidates: [],
        errors: [`serp_sources: ${this.describe(error)}`],
      }));
  }

  // Tries the first names one at a time and stops at the first that yields a
  // verified person, so a brand that fails is retried under its legal name
  private async searchBrightData({
    identity,
    cell,
    titles,
    location,
    maxBudgetUsd,
    workspaceId,
    titleExpression,
  }: {
    identity: CompanyIdentity;
    cell: QueryCell;
    titles: string[];
    location?: string;
    maxBudgetUsd: number;
    workspaceId: string;
    titleExpression?: string;
  }): Promise<{ candidates: Candidate[]; spentUsd: number }> {
    const candidates: Candidate[] = [];
    let spentUsd = 0;
    const errors: unknown[] = [];
    const cellWithTier: QueryCell = {
      ...cell,
      titles,
      titleExpression: titleExpression ?? null,
    };
    const queries = buildBrightDataCellQueries({
      identity,
      cell: cellWithTier,
      location,
    });
    // One canonical company, not its spelling list: the filter is code-owned
    // now, so two spellings would only duplicate the same rows
    const companyNames = identity.aliases.slice(
      0,
      MAX_COMPANY_NAMES_PER_SEARCH,
    );
    const countryCodes = identityCountryCodes(identity, location);
    // Two engines over the same cell. Ludicrous plans, samples and pages (the
    // deep, expensive one); instant is one token-ranked call that is good at
    // "the obvious few". Running both raises recall on the cells where the
    // planner's filters are right and rescues the ones where they are not.
    // The planner's deep search keeps the pair's whole per-cell budget: it is
    // the one that pages. Instant is bounded by its record limit instead, so
    // running it beside ludicrous adds recall without halving the depth of the
    // engine that actually needs the money.
    const instantLimit = BRIGHT_DATA_CANDIDATES_PER_SEARCH;
    // Industry is resolved with the company, but it is off as a filter by
    // default: the company anchor already pins the employer, and LinkedIn's
    // industry label for that employer can differ from ours, so the filter
    // would only drop rows. The flag lets a run measure it before that changes.
    const industryLabels = shouldSendIndustryToQueries(identity)
      ? [identity.industry as string]
      : [];
    const settle = <TValue>(
      promise: Promise<TValue>,
    ): Promise<TValue | undefined> =>
      promise.catch((error) => {
        errors.push(error);

        return undefined;
      });

    const [ludicrous, instant] = await Promise.all([
      settle(
        withBrightDataPeopleSlot(() =>
          this.brightDataLudicrousSearchService
            .searchNaturalLanguage({
              workspaceId,
              projectId: 'find-people-by-company',
              entity: 'people',
              rawQuery: queries.ludicrous,
              maxBudgetUsd,
              targetCount: BRIGHT_DATA_CANDIDATES_PER_SEARCH,
              ...(isNonEmptyString(titleExpression) && { titleExpression }),
              ...(companyNames.length > 0 && { companyNames }),
              ...(countryCodes.length > 0 && { countryCodes }),
              ...(industryLabels.length > 0 && { industryLabels }),
            })
            .then(({ result }) => result),
        ),
      ),
      settle(
        this.brightDataBusinessSearchService.search({
          entity: 'people',
          mode: 'instant',
          query: queries.instant,
          limit: instantLimit,
          workspaceId,
        }),
      ),
    ]);

    // Both engines failing is a source_error, not an empty answer: the pair is
    // retried and reported that way. A planner failure that instant did not
    // rescue is also still a failure: instant returning nothing means the
    // source found nobody, not that the plan error did not happen.
    if (
      !isDefined(ludicrous) &&
      (instant?.documents.length ?? 0) === 0 &&
      errors.length > 0
    ) {
      throw errors[0];
    }

    const documents = [
      ...(ludicrous?.documents ?? []),
      ...(instant?.documents ?? []),
    ];

    spentUsd += ludicrous?.spentUsd ?? 0;
    spentUsd += instant?.costUsd ?? 0;

    // The same person can come back from both engines
    const seen = new Set<string>();

    for (const document of documents) {
      const item = mapBrightDataPersonToSearchItem(document);
      const name = typeof item.name === 'string' ? item.name : '';

      if (name === '') {
        continue;
      }

      const key =
        document.brightId ||
        (typeof item.url === 'string' && item.url.trim() !== ''
          ? item.url.trim().toLowerCase()
          : `${name.toLowerCase()}|${String(item.companyName ?? '').toLowerCase()}`);

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);

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

    return { candidates, spentUsd };
  }

  // The company's LinkedIn URL, resolved once per company: the index supplies
  // it for free, otherwise Harvest's own company search does. Before this it
  // was re-resolved inside every role and every tier.
  private async resolveHarvestCompanyUrl(
    harvest: HarvestLinkedinService,
    identity: CompanyIdentity,
  ): Promise<string | null> {
    if (isNonEmptyString(identity.linkedinUrl)) {
      return identity.linkedinUrl;
    }

    for (const variant of identity.aliases.slice(0, 2)) {
      const match = await harvest
        .findCompanyLinkedinUrl(variant)
        .catch(() => null);

      if (isNonEmptyString(match?.linkedinUrl)) {
        return match.linkedinUrl;
      }
    }

    return null;
  }

  // Harvest Sales Navigator lead search. Employers filter by LinkedIn URL, so
  // the company is resolved once per company and passed in, instead of once per
  // role and per tier. The query is built in Harvest's own parameter names and
  // then passed through the allowlist, so a parameter Harvest does not
  // document is reported instead of quietly returning no rows.
  private async searchHarvest({
    identity,
    cell,
    titles,
    location,
    maxBudgetUsd,
    companyLinkedinUrl,
  }: {
    identity: CompanyIdentity;
    cell: QueryCell;
    titles: string[];
    location?: string;
    maxBudgetUsd: number;
    companyLinkedinUrl: string | null;
  }): Promise<{
    candidates: Candidate[];
    spentUsd: number;
    errors: string[];
  }> {
    const harvest = this.harvestLinkedinService;

    if (!isDefined(harvest)) {
      return { candidates: [], spentUsd: 0, errors: [] };
    }

    const maxRecords = Math.max(
      1,
      Math.min(
        HARVEST_CANDIDATES_PER_SEARCH,
        Math.floor(maxBudgetUsd / HARVEST_COST_PER_RECORD_USD),
      ),
    );

    if (companyLinkedinUrl === null) {
      return {
        candidates: [],
        spentUsd: 0,
        errors: ['harvest: could not resolve the company LinkedIn URL'],
      };
    }

    // Sales Nav facets: the taxonomy root and grade map to Harvest's own ids,
    // which are exact filters where a title string is a fuzzy one. Industry
    // stays opt-in for the reason above the Bright Data path: the company
    // anchor already pins the employer, so an industry filter can only drop
    // rows whose label LinkedIn spells differently.
    const salesNavFilters = resolveSalesNavFilters({
      functionRoot: cell.functionRoot,
      stdGrade: cell.grade,
    });
    const functionId = resolveHarvestFunctionIdForRoot(cell.functionRoot);
    const industryIds = shouldSendIndustryToQueries(identity)
      ? resolveHarvestIndustryIds([identity.industry ?? ''])
      : [];
    // A location string with commas is read as several locations, so the id is
    // what keeps "Mumbai, Maharashtra, India" from widening to all of India
    const geoIds = await harvest.resolveGeoIds(location ?? '');
    const parameters = buildHarvestCellParameters({
      identity,
      cell: { ...cell, titles },
      location,
      geoIds,
      companyLinkedinUrl,
      industryIds,
      functionIds: functionId ? [functionId] : [],
      seniorityLevelIds: resolveHarvestSeniorityLevelIds(
        salesNavFilters.seniorities,
      ),
    });
    const { query, ignored } = buildHarvestSearchQuery('leads', parameters);

    if (ignored.length > 0) {
      this.logger.warn(
        `find_people_by_company "${identity.canonicalName}": Harvest ignored unsupported lead parameters: ${ignored.join(', ')}`,
      );
    }

    if (!harvestParametersHaveCompany(query)) {
      return {
        candidates: [],
        spentUsd: 0,
        errors: ['harvest: query had no company filter, so it was not sent'],
      };
    }

    const result = await harvest.searchSalesNavigatorCollection({
      kind: 'leads',
      query,
      limit: maxRecords,
    });
    const candidates = result.items.flatMap((item) => {
      const candidate = this.toHarvestCandidate(item);

      return candidate === null ? [] : [candidate];
    });
    const spentUsd = Math.min(
      candidates.length * HARVEST_COST_PER_RECORD_USD,
      maxBudgetUsd,
    );

    return { candidates, spentUsd, errors: [] };
  }

  // One Sales Navigator lead row as a candidate. Shared by the generated
  // search and the caller's direct queries so both reach the checks in the
  // same shape.
  private toHarvestCandidate(item: unknown): Candidate | null {
    const record = item as Record<string, unknown>;
    const firstName =
      typeof record.firstName === 'string' ? record.firstName : '';
    const lastName = typeof record.lastName === 'string' ? record.lastName : '';
    const headline = typeof record.headline === 'string' ? record.headline : '';
    const name =
      `${firstName} ${lastName}`.trim() ||
      (typeof record.name === 'string' ? record.name : '');
    const position =
      Array.isArray(record.currentPositions) &&
      typeof record.currentPositions[0] === 'object' &&
      record.currentPositions[0] !== null
        ? (record.currentPositions[0] as Record<string, unknown>)
        : {};
    const title =
      typeof position.title === 'string' ? position.title : headline;
    const companyName =
      typeof position.companyName === 'string' ? position.companyName : '';
    const linkedinUrl =
      typeof record.linkedinUrl === 'string' ? record.linkedinUrl : '';
    const itemLocation =
      typeof record.location === 'string'
        ? record.location
        : typeof record.location === 'object' && record.location !== null
          ? String(
              (record.location as Record<string, unknown>).linkedinText ?? '',
            )
          : '';

    if (name === '') {
      return null;
    }

    return {
      id: `harvest:${linkedinUrl || name}`,
      name,
      title,
      companyName,
      linkedinUrl,
      evidenceText: headline,
      source: 'harvest',
      location: itemLocation,
      rawProfile: record,
    };
  }

  // The model reads the raw results; if it is unavailable the LinkedIn result
  // titles are split by pattern instead, so a model outage costs accuracy, not
  // the whole Google source
  private async extractPeople({
    company,
    variants,
    roles,
    results,
    aiOverviewTexts,
    workspaceId,
    sourceErrors,
  }: {
    company: string;
    variants: string[];
    roles: string[];
    results: GoogleSerpOrganicItem[];
    aiOverviewTexts: string[];
    workspaceId: string;
    sourceErrors: string[];
  }): Promise<ExtractedPerson[]> {
    if (results.length === 0 && aiOverviewTexts.length === 0) {
      return [];
    }

    try {
      return await this.googleResultExtractionService.extract({
        workspaceId,
        company,
        roles,
        results,
        aiOverview: aiOverviewTexts.join('\n\n'),
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
            linkedinUrlDerivedFromPost: false,
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

  // A result whose "title" is the employer's name tells us nothing about the
  // person; keeping it would let the judge read the role off the wrong field
  private cleanTitle(title: string, companyName: string): string {
    const normalized = (value: string): string =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\b(limited|ltd|pvt|private|inc|llp|plc)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const candidate = normalized(title);

    if (candidate === '' || candidate === normalized(companyName)) {
      return '';
    }

    return title;
  }

  private toCandidate(person: ExtractedPerson, source: Source): Candidate {
    return {
      id: toId(
        isNonEmptyString(person.linkedinUrl)
          ? normalizeLinkedinProfileUrl(person.linkedinUrl)
          : `${person.name}|${person.companyName}`,
      ),
      name: person.name,
      title: this.cleanTitle(person.jobTitle, person.companyName),
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
    criteria,
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
    criteria?: string[];
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
        criteria,
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

  // Worth a paid Bright Data lookup only when the title could hold the role and
  // the company on the result matches by name. A person at a parent or operator is still read by the
  // judge, from the company and title their own result states.
  private worthLookingUp(candidate: Candidate, variants: string[]): boolean {
    if (!isLeadershipCandidateTitle(candidate.title)) {
      return false;
    }

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
          title: candidate.title,
          // A past holder or a namesake is dropped below, so only the current
          // company search is paid for, and Google only when it misses
          currentCompanyOnly: true,
          googleOnlyWhenBrightDataMisses: true,
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
        // A past role is the person, but not the current role holder
        const profiles = resolutions[index].profiles.filter(
          (profile) => profile.companyRelation !== 'past',
        );

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

  // A stated person criterion the profile shows the person lacks rejects them;
  // one the profile does not settle keeps them, marked, so the user decides
  private splitByCriteria(
    verified: VerifiedCandidate[],
    rejected: RejectedCandidate[],
  ): { verified: VerifiedCandidate[]; rejected: RejectedCandidate[] } {
    const mismatched = verified.filter((person) =>
      (person.verdict?.criteria ?? []).some(
        (criterion) => criterion.verdict === 'mismatch',
      ),
    );

    if (mismatched.length === 0) {
      return { verified, rejected };
    }

    const mismatchedIds = new Set(mismatched.map((person) => person.id));

    return {
      verified: verified.filter((person) => !mismatchedIds.has(person.id)),
      rejected: [
        ...rejected,
        ...mismatched.map((person) => ({
          name: person.name,
          title: person.title,
          companyOnProfile: person.companyName,
          reason: 'criteria_mismatch' as const,
          note: (person.verdict?.criteria ?? [])
            .filter((criterion) => criterion.verdict === 'mismatch')
            .map((criterion) => criterion.criterion)
            .join('; ')
            .slice(0, 160),
        })),
      ],
    };
  }

  private async verify({
    candidates,
    variants,
    roles,
    requestedClasses,
    roleClasses,
    scope = 'role',
    verdicts = new Map<string, PersonJudgement>(),
  }: {
    candidates: Candidate[];
    variants: string[];
    roles: string[];
    requestedClasses: TitleClass[];
    roleClasses?: Record<string, TitleClass | null>;
    scope?: 'role' | 'family';
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
      const candidateClass =
        titleClasses?.get(candidate.title.trim().toLowerCase()) ?? null;
      const roleScore = isDefined(verdict)
        ? ({ exact: 2, related: 1, none: 0 } as const)[verdict.role]
        : scoreRoleMatch({
            title: candidate.title,
            roles,
            requestedClasses,
            candidateClass,
            scope,
          });
      const roleMatches = this.roleMatchesOf({
        title: candidate.title,
        roles,
        roleClasses,
        candidateClass,
        roleScore,
        scope,
        queriedRole: candidate.queriedRole,
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
      // One person read twice under a one-letter spelling slip or a dropped
      // middle name: once with a profile URL and once without, or once with a
      // member id (Harvest) and once with a vanity slug (Google)
      const existing =
        byKey.get(key) ??
        [...byKey.values()].find(
          (other) =>
            !linkedinUrlsAreComparable(
              other.linkedinUrl,
              candidate.linkedinUrl,
            ) && personNamesRoughlyMatch(other.name, candidate.name),
        );

      if (isDefined(existing)) {
        // The vanity slug wins over a member id: it is the URL people can read
        if (
          isNonEmptyString(candidate.linkedinUrl) &&
          (!isNonEmptyString(existing.linkedinUrl) ||
            (isOpaqueLinkedinId(existing.linkedinUrl) &&
              !isOpaqueLinkedinId(candidate.linkedinUrl)))
        ) {
          existing.linkedinUrl = candidate.linkedinUrl;
          existing.name = candidate.name;
        }

        if (!existing.sources.includes(candidate.source)) {
          existing.sources.push(candidate.source);
        }

        const mergedMatches = new Map(
          [...(existing.roleMatches ?? []), ...roleMatches].map((match) => [
            match.role,
            match,
          ]),
        );

        existing.roleMatches = [...mergedMatches.values()];

        continue;
      }

      byKey.set(key, {
        ...candidate,
        sources: [candidate.source],
        roleScore,
        roleMatches,
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

  // One state per requested role. A company with a CEO and no plant head is
  // found for the CEO pair and none_found for the manufacturing pair, so the
  // coverage line cannot hide the missing role.
  private roleStatesOf({
    roles,
    people,
    terminalState,
    reason,
    rejectedCount,
  }: {
    roles: string[];
    people: CompanyOutcome['people'];
    terminalState: FindPeopleTerminalState;
    reason?: string;
    rejectedCount: number;
  }): FindPeopleRoleState[] {
    const keyOf = (person: CompanyOutcome['people'][number]): string =>
      isNonEmptyString(person.linkedinUrl)
        ? normalizeLinkedinProfileUrl(person.linkedinUrl)
        : person.name;

    return roles.map((role) => {
      const matched = people.filter((person) =>
        (person.roleMatches ?? []).some(
          (match) =>
            match.role.trim().toLowerCase() === role.trim().toLowerCase(),
        ),
      );

      if (matched.length > 0) {
        return {
          role,
          terminalState: 'found' as const,
          rungUsed: Math.min(
            ...matched.map((person) => person.rungUsed),
          ) as FindPeopleRung,
          personKeys: [...new Set(matched.map(keyOf))],
          sourcesUsed: [
            ...new Set(matched.flatMap((person) => person.sources)),
          ],
          peopleCount: matched.length,
        };
      }

      const reasonForRole: FindPeopleNoneFoundReason | string =
        reason === 'source_error' || reason === 'budget'
          ? reason
          : rejectedCount > 0
            ? 'profile_gaps'
            : 'no_such_role';

      if (terminalState === 'unresolvable') {
        return {
          role,
          terminalState,
          ...(reason !== undefined && { reason }),
          personKeys: [],
          sourcesUsed: [],
          peopleCount: 0,
        };
      }

      if (terminalState === 'ambiguous') {
        return {
          role,
          terminalState,
          reason: reason ?? 'low_confidence',
          personKeys: [],
          sourcesUsed: [],
          peopleCount: 0,
        };
      }

      if (terminalState === 'excluded') {
        return {
          role,
          terminalState,
          ...(reason !== undefined && { reason }),
          personKeys: [],
          sourcesUsed: [],
          peopleCount: 0,
        };
      }

      return {
        role,
        terminalState: 'none_found' as const,
        reason: reasonForRole,
        personKeys: [],
        sourcesUsed: [],
        peopleCount: 0,
      };
    });
  }

  // The specific roles a title satisfies. The taxonomy class is shared by a
  // function and grade, so "VP Manufacturing" matches "Head of Manufacturing"
  // even though it contains none of its words. A judge-only match with no text
  // or class match goes to the role its title is closest to, so every kept
  // person counts once and a second role can still be filled.
  private roleMatchesOf({
    title,
    roles,
    roleClasses,
    candidateClass,
    roleScore,
    scope = 'role',
    queriedRole,
  }: {
    title: string;
    roles: string[];
    roleClasses: Record<string, TitleClass | null> | undefined;
    candidateClass: TitleClass | null;
    roleScore: 0 | 1 | 2;
    scope?: 'role' | 'family';
    queriedRole?: string;
  }): RoleMatch[] {
    const matches: RoleMatch[] = [];

    for (const role of roles) {
      const roleClass = roleClasses?.[role.trim().toLowerCase()] ?? null;
      const score = scoreRoleMatch({
        title,
        roles: [role],
        requestedClasses: roleClass === null ? [] : [roleClass],
        candidateClass,
        scope,
      });

      if (score === 2) {
        matches.push({ role, score: 2 });
      } else if (score === 1) {
        matches.push({ role, score: 1 });
      }
    }

    if (matches.length > 0 || roles.length === 0 || roleScore === 0) {
      return matches;
    }

    const closest = closestRequestedRole(title, roles, queriedRole);

    return isDefined(closest) ? [{ role: closest, score: roleScore }] : [];
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
