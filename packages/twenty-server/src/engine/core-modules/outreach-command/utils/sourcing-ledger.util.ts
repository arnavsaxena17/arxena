import { type OutreachTabRow } from 'src/engine/core-modules/outreach-command/services/outreach-tab.service';
import { readRowProfile } from 'src/engine/core-modules/candidate-sourcing/services/profile-fetch/profile-row-fields.util';
import {
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

// What was agreed before the search started, so the final report can quote it
export type SourcingBrief = {
  requestType: SourcingRequestType;
  // How many the user asked for; null when they did not say
  target: number | null;
  // Who or what is wanted, in the user's words
  who: string;
  criteria: Array<{ description: string; mustHave: boolean }>;
  geography?: string;
  exclusions?: string;
  // Spend the user approved, in USD. perPair caps one company x role lookup
  // across every source
  capsUsd?: { fetch?: number; enrich?: number; perPair?: number };
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
  pairs: number;
  byState: Record<FindPeopleTerminalState, number>;
  // Companies with no pair yet for any role
  notLookedUp: number;
  byRung: Record<string, number>;
  bySource: Record<string, number>;
  topReasons: Array<{ reason: string; count: number }>;
  costUsd: number;
  // Share of pairs found, of those that reached a state
  resolutionRate: number;
  costPerFoundUsd: number | null;
  coverageLine: string;
};

const TERMINAL_STATES: FindPeopleTerminalState[] = [
  'found',
  'none_found',
  'ambiguous',
  'unresolvable',
  'excluded',
];

// Built from the company rows, never from memory, so the report is right
// after a compaction or a resumed run
export const computePairFunnel = (
  companyRows: OutreachTabRow[],
): SourcingPairFunnel => {
  const byState = Object.fromEntries(
    TERMINAL_STATES.map((state) => [state, 0]),
  ) as Record<FindPeopleTerminalState, number>;
  const byRung: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const reasons = new Map<string, number>();
  let pairs = 0;
  let notLookedUp = 0;
  let costUsd = 0;

  for (const row of companyRows) {
    const states: FindPeoplePairState[] = Object.values(
      readPairStates(row.otherFields),
    );

    if (states.length === 0) {
      notLookedUp += 1;
      continue;
    }

    for (const pair of states) {
      pairs += 1;
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
  }

  const found = byState.found;
  const review = byState.ambiguous;
  const missing = byState.none_found + byState.unresolvable;

  return {
    companies: companyRows.length,
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
      `${found} of ${pairs} covered; ${missing} none found (reasons attached); ${review} need your review` +
      (byState.excluded > 0 ? `; ${byState.excluded} excluded` : '') +
      (notLookedUp > 0 ? `; ${notLookedUp} companies not looked up yet` : '') +
      '.',
  };
};
