import { type OutreachTabRow } from 'src/engine/core-modules/outreach-command/services/outreach-tab.service';
import { readRowProfile } from 'src/engine/core-modules/candidate-sourcing/services/profile-fetch/profile-row-fields.util';
import {
  pairKeyOf,
  type FindPeoplePairState,
  type FindPeopleTerminalState,
  readPairStates,
} from 'src/engine/core-modules/outreach-command/utils/outreach-people-found.util';

// What happened in a sourcing run, kept so a shortfall can be explained from
// data and not from what the conversation still remembers
export type SourcingRequestType =
  | 'population'
  | 'named_role'
  | 'company_list'
  | 'scored_list'
  | 'look_alike'
  | 'expand';

// best_effort stops at the target; exhaustive stops when the universe is
// covered or the run cap is hit. It changes the stop rule and the report, so
// it is part of the plan, not a phrase in the chat.
export type SourcingCoverage = 'best_effort' | 'exhaustive';

// What "everything" means for an exhaustive run. A run without one is not
// exhaustive, it is unbounded.
export type SourcingUniverse = {
  kind?: 'project' | 'view' | 'list' | 'lens_set' | 'other';
  count?: number;
  note?: string;
};

// One planned (source, query) pair. Population exhaustive runs write these
// before the first search; the ledger compares them with the lists that
// actually ran, so an unattempted query is visible instead of forgotten.
export type SourcingQueryPlan = {
  source?: string;
  query: string;
  slice?: string;
  role?: string;
  entity?: 'company' | 'people';
};

// What was agreed before the search started, so the final report can quote it
export type SourcingBrief = {
  requestType: SourcingRequestType;
  // The brief as the user wrote it, when it arrived as prose
  briefText?: string;
  // How many the user asked for; null when they did not say
  target: number | null;
  // Who or what is wanted, in the user's words
  who: string;
  criteria: Array<{ description: string; mustHave: boolean }>;
  geography?: string;
  exclusions?: string;
  // Spend the user approved, in USD. perPair caps one company x role lookup
  // across every source; run caps the whole run. The paid tools read it, they
  // never raise it.
  capsUsd?: {
    fetch?: number;
    enrich?: number;
    perPair?: number;
    run?: number;
  };
  coverage?: SourcingCoverage;
  universe?: SourcingUniverse;
  queries?: SourcingQueryPlan[];
  // Server-set: identifies the budget window. A new run cap starts a new one,
  // so a second run is not blocked by the first run's spend.
  budgetRunId?: string;
  destination?: string;
  // Defaults the agent chose and told the user about, instead of asking
  assumptions: string[];
  // The rest is the plan of a company x role run. All optional, so a brief
  // written before these fields existed still reads.
  persona?: SourcingPersona;
  targetType?: SourcingTargetType;
  roles?: string[];
  // Highest title rung a pair may be found at (see FindPeopleRung)
  ladder?: { maxRung: 1 | 2 | 3 | 4 };
  thresholds?: {
    minConfidence?: SourcingConfidence;
    freshnessDays?: number;
  };
  // Source keys the user picked at the start (SOURCING_SOURCES keys); tools
  // for any other source refuse while this brief stands
  sources?: string[];
  // A confidential project neither reads nor writes the workspace cache
  confidential?: boolean;
  version?: number;
};

export type SourcingPersona = 'sales' | 'exec_search';

export type SourcingTargetType =
  | 'decision_maker'
  | 'incumbent'
  | 'candidate_pool';

export type SourcingConfidence = 'high' | 'medium' | 'low';

const PERSONA_ALIASES: Record<string, SourcingPersona> = {
  sales: 'sales',
  sales_prospect: 'sales',
  'sales-prospect': 'sales',
  prospect: 'sales',
  prospects: 'sales',
  'for-sales': 'sales',
  for_sales: 'sales',
  exec_search: 'exec_search',
  'exec-search': 'exec_search',
  exec: 'exec_search',
  recruiting: 'exec_search',
  recruitment: 'exec_search',
  hiring: 'exec_search',
  candidate: 'exec_search',
  candidates: 'exec_search',
  'for-recruiting': 'exec_search',
  for_recruiting: 'exec_search',
};

const COVERAGE_ALIASES: Record<string, SourcingCoverage> = {
  best_effort: 'best_effort',
  'best-effort': 'best_effort',
  'best effort': 'best_effort',
  best: 'best_effort',
  default: 'best_effort',
  standard: 'best_effort',
  exhaustive: 'exhaustive',
  complete: 'exhaustive',
  'complete coverage': 'exhaustive',
  'complete-coverage': 'exhaustive',
  full: 'exhaustive',
  all: 'exhaustive',
  mece: 'exhaustive',
  'no gaps': 'exhaustive',
  'no-gaps': 'exhaustive',
};

const REQUEST_TYPE_ALIASES: Record<string, SourcingRequestType> = {
  population: 'population',
  named_role: 'named_role',
  'named-role': 'named_role',
  role: 'named_role',
  role_at_companies: 'named_role',
  company_list: 'company_list',
  'company-list': 'company_list',
  companies: 'company_list',
  company_first: 'company_list',
  'company-first': 'company_list',
  'role-plus-industry-country': 'company_list',
  role_plus_industry_country: 'company_list',
  role_at_industry: 'company_list',
  scored_list: 'scored_list',
  'scored-list': 'scored_list',
  look_alike: 'look_alike',
  'look-alike': 'look_alike',
  lookalike: 'look_alike',
  expand: 'expand',
};

const asTrimmedString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;

// "queries": ["CEO at Acme", { source, query, slice }] and the older
// "queryPlan" name all become the same list. A query with no text is dropped
// rather than left to match every list.
const normalizeQueryPlan = (
  value: unknown,
): SourcingQueryPlan[] | undefined => {
  const items = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? [value]
      : undefined;

  if (items === undefined) {
    return undefined;
  }

  const queries = items
    .map((item): SourcingQueryPlan | undefined => {
      if (typeof item === 'string') {
        const query = asTrimmedString(item);

        return query === undefined ? undefined : { query };
      }

      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        return undefined;
      }

      const record = item as Record<string, unknown>;
      const query = asTrimmedString(record.query ?? record.q);
      const entity =
        record.entity === 'company' || record.entity === 'people'
          ? record.entity
          : undefined;

      return query === undefined
        ? undefined
        : {
            query,
            ...(asTrimmedString(record.source) !== undefined && {
              source: asTrimmedString(record.source),
            }),
            ...(asTrimmedString(record.slice) !== undefined && {
              slice: asTrimmedString(record.slice),
            }),
            ...(asTrimmedString(record.role) !== undefined && {
              role: asTrimmedString(record.role),
            }),
            ...(entity !== undefined && { entity }),
          };
    })
    .filter((query): query is SourcingQueryPlan => query !== undefined);

  return queries.length > 0 ? queries.slice(0, 50) : undefined;
};

const normalizeUniverse = (value: unknown): SourcingUniverse | undefined => {
  if (typeof value === 'string') {
    const note = asTrimmedString(value);

    return note === undefined ? undefined : { kind: 'other', note };
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const kinds = ['project', 'view', 'list', 'lens_set', 'other'];
  const kind = kinds.includes(String(record.kind))
    ? (record.kind as SourcingUniverse['kind'])
    : undefined;
  const count = Number(record.count);
  const note = asTrimmedString(record.note);

  return {
    ...(kind !== undefined && { kind }),
    ...(Number.isFinite(count) && count >= 0 && { count }),
    ...(note !== undefined && { note }),
  };
};

// Tools receive what the model wrote, not what the schema wished for: a prose
// brief, one role as a string, "sales_prospect" for persona. Accept those
// shapes and normalise them, so a near-correct call is not a failed call.
export const normalizeSourcingBriefDraft = (
  value: unknown,
): Partial<SourcingBrief> | undefined => {
  if (typeof value === 'string') {
    const text = value.trim();

    return text.length > 0
      ? { briefText: text, who: text.slice(0, 300), requestType: 'named_role' }
      : undefined;
  }

  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  const draft: Record<string, unknown> = {
    ...(value as Record<string, unknown>),
  };

  if (typeof draft.roles === 'string') {
    draft.roles = draft.roles
      .split(',')
      .map((role) => role.trim())
      .filter((role) => role.length > 0);
  }

  if (typeof draft.persona === 'string') {
    const persona = PERSONA_ALIASES[draft.persona.trim().toLowerCase()];

    if (persona !== undefined) {
      draft.persona = persona;
    }
  }

  if (typeof draft.requestType === 'string') {
    const requestType =
      REQUEST_TYPE_ALIASES[draft.requestType.trim().toLowerCase()];

    if (requestType !== undefined) {
      draft.requestType = requestType;
    }
  }

  if (typeof draft.sources === 'string') {
    draft.sources = [draft.sources];
  }

  if (typeof draft.coverage === 'string') {
    const coverage = COVERAGE_ALIASES[draft.coverage.trim().toLowerCase()];

    if (coverage !== undefined) {
      draft.coverage = coverage;
    }
  }

  if (
    typeof draft.capsUsd === 'object' &&
    draft.capsUsd !== null &&
    !Array.isArray(draft.capsUsd)
  ) {
    const caps = { ...(draft.capsUsd as Record<string, unknown>) };

    for (const key of ['fetch', 'enrich', 'perPair', 'run']) {
      const value = caps[key];

      if (
        typeof value === 'string' &&
        value.trim().length > 0 &&
        Number.isFinite(Number(value))
      ) {
        caps[key] = Number(value);
      }
    }

    draft.capsUsd = caps;
  }

  const queries = normalizeQueryPlan(draft.queries ?? draft.queryPlan);

  if (queries !== undefined) {
    draft.queries = queries;
  }

  // The brief schema is an array of must/nice criteria and an array of
  // assumptions. A model that writes one prose string or a by-area object is
  // normalized here, so the report does not have to defend against it.
  if (typeof draft.assumptions === 'string') {
    draft.assumptions = [draft.assumptions];
  }

  if (typeof draft.criteria === 'string') {
    draft.criteria = [{ description: draft.criteria, mustHave: true }];
  } else if (
    typeof draft.criteria === 'object' &&
    draft.criteria !== null &&
    !Array.isArray(draft.criteria)
  ) {
    draft.criteria = Object.entries(
      draft.criteria as Record<string, unknown>,
    ).map(([key, value]) => ({
      description: `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`,
      mustHave: true,
    }));
  }

  const universe = normalizeUniverse(draft.universe);

  if (universe !== undefined) {
    draft.universe = universe;
  }

  return draft as Partial<SourcingBrief>;
};

export const SOURCING_PLAN_DEFAULTS = {
  minConfidence: 'medium' as SourcingConfidence,
  freshnessDays: 365,
  perPairUsd: 0.1,
  // Sales accepts an adjacent role or the owner; exec search wants the role
  maxRungByPersona: { sales: 4, exec_search: 2 } as const,
};

// Later briefs refine earlier ones: a field left out keeps its value, so the
// agent can add the chosen sources without restating the criteria
export const mergeSourcingBrief = (
  previous: SourcingBrief | undefined,
  next: Partial<SourcingBrief>,
): SourcingBrief => {
  const defined = Object.fromEntries(
    Object.entries(next).filter(([, value]) => value !== undefined),
  ) as Partial<SourcingBrief>;

  return {
    requestType: 'named_role',
    target: null,
    who: '',
    criteria: [],
    assumptions: [],
    ...previous,
    ...defined,
    ...((previous?.capsUsd !== undefined || defined.capsUsd !== undefined) && {
      capsUsd: { ...previous?.capsUsd, ...defined.capsUsd },
    }),
    ...((previous?.universe !== undefined ||
      defined.universe !== undefined) && {
      universe: { ...previous?.universe, ...defined.universe },
    }),
    ...((previous?.thresholds !== undefined ||
      defined.thresholds !== undefined) && {
      thresholds: { ...previous?.thresholds, ...defined.thresholds },
    }),
    version: (previous?.version ?? 0) + 1,
  };
};

export type SourcingLedgerEvent =
  | ({ kind: 'brief'; at: string } & SourcingBrief)
  | {
      // One search that wrote rows to the project tab. This replaces the old
      // per-list metadata used for the ledger, coverage and spend.
      kind: 'search';
      at: string;
      source: string;
      entity: 'company' | 'people';
      query: string;
      fetched: number;
      duplicates: number;
      newUnique: number;
      alreadyKnown: number;
      spentUsd: number;
    }
  | {
      kind: 'score';
      at: string;
      stage: 'snapshot' | 'profile';
      column: string;
      rows: number;
      pass: number;
      unknown: number;
      fail: number;
      failedRows: number;
      threshold: number;
      costUsd: number | null;
    }
  | {
      kind: 'profile_fetch';
      at: string;
      requested: number;
      brightData: number;
      harvest: number;
      notFound: number;
      // People with no LinkedIn URL whose URL was found by name and company
      resolvedByName?: number;
      resolvedByGoogle?: number;
      remaining: number;
    }
  | {
      kind: 'stop';
      at: string;
      target: number | null;
      qualified: number;
      because: string;
    }
  | {
      kind: 'checkpoint';
      at: string;
      stage: 'pilot' | 'halfway' | 'complete';
      runId?: string;
      pairs: SourcingPairFunnel;
    };

export type SourcingFunnel = {
  rows: number;
  withLinkedinUrl: number;
  withoutLinkedinUrl: number;
  withProfile: { brightData: number; harvest: number };
  notScored: number;
  outcomes: { pass: number; unknown: number; fail: number };
  // Passed on the full profile: these count toward the target
  qualified: number;
  // Passed or unknown on the snapshot and still without a profile
  awaitingProfile: number;
};

const outcomeOf = (
  row: OutreachTabRow,
): 'pass' | 'unknown' | 'fail' | undefined => {
  const value =
    row.otherFields.fitmentOutcome ?? row.otherFields.fitment_outcome;

  return value === 'pass' || value === 'unknown' || value === 'fail'
    ? value
    : undefined;
};

export const computeSourcingFunnel = (
  rows: OutreachTabRow[],
): SourcingFunnel => {
  const funnel: SourcingFunnel = {
    rows: rows.length,
    withLinkedinUrl: 0,
    withoutLinkedinUrl: 0,
    withProfile: { brightData: 0, harvest: 0 },
    notScored: 0,
    outcomes: { pass: 0, unknown: 0, fail: 0 },
    qualified: 0,
    awaitingProfile: 0,
  };

  for (const row of rows) {
    const hasUrl = (row.linkedinUrl ?? '').trim() !== '';
    const profile = readRowProfile(row.otherFields);
    const outcome = outcomeOf(row);

    if (hasUrl) {
      funnel.withLinkedinUrl += 1;
    } else {
      funnel.withoutLinkedinUrl += 1;
    }

    if (profile?.source === 'bright_data') {
      funnel.withProfile.brightData += 1;
    } else if (profile?.source === 'harvest') {
      funnel.withProfile.harvest += 1;
    }

    if (outcome === undefined) {
      funnel.notScored += 1;
      continue;
    }

    funnel.outcomes[outcome] += 1;

    if (outcome === 'pass' && profile !== undefined) {
      funnel.qualified += 1;
    }

    if (outcome !== 'fail' && hasUrl && profile === undefined) {
      funnel.awaitingProfile += 1;
    }
  }

  return funnel;
};

export type SourcingPairFunnel = {
  companies: number;
  // One pair is expected per company for the role set being measured
  expectedPairs: number;
  pairs: number;
  byState: Record<FindPeopleTerminalState, number>;
  // Companies with no pair yet for this role set
  notLookedUp: number;
  byRung: Record<string, number>;
  bySource: Record<string, number>;
  topReasons: Array<{ reason: string; count: number }>;
  costUsd: number;
  // Share of pairs found, of those that reached a state
  resolutionRate: number;
  costPerFoundUsd: number | null;
  // The role set the line was computed for, when one was given
  roleKey?: string;
  coverageLine: string;
};

const TERMINAL_STATES: FindPeopleTerminalState[] = [
  'found',
  'none_found',
  'ambiguous',
  'unresolvable',
  'excluded',
];

// Counts a set of company x role pairs. One pair is one company and one
// role, so a four-role company contributes four pairs and a CEO found no
// longer hides a missing head of manufacturing.
export type SourcingPairFunnelInput = Pick<
  FindPeoplePairState,
  'terminalState' | 'reason' | 'rungUsed' | 'sourcesUsed' | 'costUsd'
>;

export const summarizePairStates = (
  pairStates: SourcingPairFunnelInput[],
  {
    companies,
    expectedPairs,
    notLookedUpCompanies,
  }: {
    companies: number;
    expectedPairs: number;
    // When the role set is unknown, a company with no pair is what is missing
    notLookedUpCompanies?: number;
  },
): SourcingPairFunnel => {
  const byState = Object.fromEntries(
    TERMINAL_STATES.map((state) => [state, 0]),
  ) as Record<FindPeopleTerminalState, number>;
  const byRung: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const reasons = new Map<string, number>();
  let costUsd = 0;

  for (const pair of pairStates) {
    byState[pair.terminalState] = (byState[pair.terminalState] ?? 0) + 1;
    costUsd += pair.costUsd ?? 0;

    if (pair.rungUsed !== undefined) {
      byRung[`rung${pair.rungUsed}`] =
        (byRung[`rung${pair.rungUsed}`] ?? 0) + 1;
    }

    for (const source of pair.sourcesUsed ?? []) {
      bySource[source] = (bySource[source] ?? 0) + 1;
    }

    if (pair.terminalState !== 'found') {
      const reason = `${pair.terminalState}${pair.reason ? `: ${pair.reason}` : ''}`;

      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    }
  }

  const pairs = pairStates.length;
  const found = byState.found;
  const review = byState.ambiguous;
  const missing = byState.none_found + byState.unresolvable;
  const notLookedUp =
    notLookedUpCompanies ?? Math.max(0, expectedPairs - pairs);

  return {
    companies,
    expectedPairs,
    pairs,
    byState,
    notLookedUp,
    byRung,
    bySource,
    topReasons: [...reasons.entries()]
      .sort((first, second) => second[1] - first[1])
      .slice(0, 5)
      .map(([reason, count]) => ({ reason, count })),
    costUsd: Number(costUsd.toFixed(4)),
    resolutionRate: pairs > 0 ? Number((found / pairs).toFixed(2)) : 0,
    costPerFoundUsd: found > 0 ? Number((costUsd / found).toFixed(4)) : null,
    coverageLine:
      notLookedUpCompanies === undefined
        ? `${found} of ${expectedPairs} company x role pairs covered; ${missing} none found (reasons attached); ${review} need your review` +
          (byState.excluded > 0 ? `; ${byState.excluded} excluded` : '') +
          (notLookedUp > 0 ? `; ${notLookedUp} pairs not looked up yet` : '') +
          '.'
        : `${found} of ${pairs} covered; ${missing} none found (reasons attached); ${review} need your review` +
          (byState.excluded > 0 ? `; ${byState.excluded} excluded` : '') +
          (notLookedUp > 0
            ? `; ${notLookedUp} companies not looked up yet`
            : '') +
          '.',
  };
};

// Built from the company rows, never from memory, so the report is right
// after a compaction or a resumed run. Pass roles to measure one role set:
// without it the line mixes every company x role pair the project has seen.
export const computePairFunnel = (
  companyRows: OutreachTabRow[],
  options: { roles?: string[] } = {},
): SourcingPairFunnel => {
  const roleKeys =
    options.roles !== undefined && options.roles.length > 0
      ? [...new Set(options.roles.map((role) => pairKeyOf([role])))]
      : undefined;
  const roleKey =
    options.roles !== undefined && options.roles.length > 0
      ? pairKeyOf(options.roles)
      : undefined;
  const selected: FindPeoplePairState[] = [];
  let companiesWithoutPairs = 0;

  for (const row of companyRows) {
    const pairs = readPairStates(row.otherFields);

    if (roleKeys === undefined) {
      const values = Object.values(pairs);

      if (values.length === 0) {
        companiesWithoutPairs += 1;
      }
      selected.push(...values);
      continue;
    }

    for (const key of roleKeys) {
      const pair =
        pairs[key] ??
        Object.values(pairs).find(
          (candidate) =>
            candidate.roles.length === 1 && pairKeyOf(candidate.roles) === key,
        );

      if (pair !== undefined) {
        selected.push(pair);
      }
    }
  }

  const funnel = summarizePairStates(selected, {
    companies: companyRows.length,
    expectedPairs:
      roleKeys === undefined
        ? selected.length
        : companyRows.length * roleKeys.length,
    ...(roleKeys === undefined && {
      notLookedUpCompanies: companiesWithoutPairs,
    }),
  });

  return {
    ...funnel,
    ...(roleKey !== undefined && { roleKey }),
  };
};

// A search as the frontier needs it: what ran, where, and what was new
export type SourcingFrontierSearch = {
  id: string;
  sources: string[];
  entity?: string;
  query?: string;
  fetched?: number;
  newUnique?: number;
  alreadyKnown?: number;
  spentUsd: number;
};

export type SourcingFrontierItem = SourcingQueryPlan & {
  attempted: boolean;
  searchIds: string[];
  fetched: number;
  // Null when the search never reached a project tab, so the count is unknown
  newUnique: number | null;
  alreadyKnown: number | null;
  spentUsd: number;
};

export type SourcingFrontier = {
  coverage: SourcingCoverage;
  universe?: SourcingUniverse;
  planned: SourcingFrontierItem[];
  attempted: number;
  unattempted: number;
  // Searches that ran but were not in the plan: scope creep, or a query the
  // agent rewrote instead of running the planned one
  unplannedSearches: number;
  complete: boolean;
  unattemptedQueries: SourcingQueryPlan[];
  coverageLine: string;
};

const normalizeSourceKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[-_\s]/g, '');

const normalizeQueryText = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

const queryMatches = (planned: string, actual: string): boolean => {
  const left = normalizeQueryText(planned);
  const right = normalizeQueryText(actual);

  if (left.length === 0 || right.length === 0) {
    return false;
  }

  return left === right || left.includes(right) || right.includes(left);
};

// The index and Wikidata searches are stored as "other" because the source
// type predates them; their query text keeps them apart from each other
const SOURCE_ALIASES: Record<string, string[]> = {
  'internal-index': ['other'],
  wikidata: ['other'],
};

const sourceMatches = (planned: string | undefined, sources: string[]) => {
  if (planned === undefined) {
    return true;
  }

  const keys = [
    normalizeSourceKey(planned),
    ...(SOURCE_ALIASES[planned] ?? []).map(normalizeSourceKey),
  ];

  return sources.some((source) => keys.includes(normalizeSourceKey(source)));
};

// The planned query matrix against the searches that actually ran. A planned
// query counts only when a search with its source and text was recorded on the
// project, so a failure is not mistaken for coverage.
export const computeSourcingFrontier = ({
  coverage,
  universe,
  queries,
  searches,
}: {
  coverage?: SourcingCoverage;
  universe?: SourcingUniverse;
  queries?: SourcingQueryPlan[];
  searches: SourcingFrontierSearch[];
}): SourcingFrontier | undefined => {
  const mode = coverage ?? 'best_effort';

  if (
    mode !== 'exhaustive' &&
    (queries === undefined || queries.length === 0)
  ) {
    return undefined;
  }

  const plannedQueries = queries ?? [];
  const usedSearchIds = new Set<string>();
  const planned: SourcingFrontierItem[] = plannedQueries.map((query) => {
    const matched = searches.filter(
      (search) =>
        sourceMatches(query.source, search.sources) &&
        (query.entity === undefined || search.entity === query.entity) &&
        queryMatches(query.query, search.query ?? ''),
    );

    matched.forEach((search) => usedSearchIds.add(search.id));

    const sum = (
      value: (search: SourcingFrontierSearch) => number | undefined,
    ) => matched.reduce((total, search) => total + (value(search) ?? 0), 0);
    const newUnique = matched.some((search) => search.newUnique !== undefined)
      ? sum((search) => search.newUnique)
      : null;
    const alreadyKnown = matched.some(
      (search) => search.alreadyKnown !== undefined,
    )
      ? sum((search) => search.alreadyKnown)
      : null;

    return {
      ...query,
      attempted: matched.length > 0,
      searchIds: matched.map((search) => search.id),
      fetched: sum((search) => search.fetched),
      newUnique,
      alreadyKnown,
      spentUsd: Number(sum((search) => search.spentUsd).toFixed(4)),
    };
  });

  const attempted = planned.filter((query) => query.attempted).length;
  const unattemptedQueries = planned
    .filter((query) => !query.attempted)
    .map(({ source, query, slice, role, entity }) => ({
      ...(source !== undefined && { source }),
      query,
      ...(slice !== undefined && { slice }),
      ...(role !== undefined && { role }),
      ...(entity !== undefined && { entity }),
    }));
  const unattempted = unattemptedQueries.length;
  const unplannedSearches = searches.filter(
    (search) => !usedSearchIds.has(search.id),
  ).length;
  // No planned queries is not "everything ran": it is no proof at all
  const complete = planned.length > 0 && unattempted === 0;

  return {
    coverage: mode,
    ...(universe !== undefined && { universe }),
    planned,
    attempted,
    unattempted,
    unplannedSearches,
    complete,
    unattemptedQueries,
    coverageLine:
      planned.length === 0
        ? 'No query plan recorded, so coverage cannot be proven.'
        : `${attempted} of ${planned.length} planned searches attempted; ${unattempted} not yet` +
          (unplannedSearches > 0
            ? `; ${unplannedSearches} unplanned searches`
            : '') +
          '.',
  };
};
