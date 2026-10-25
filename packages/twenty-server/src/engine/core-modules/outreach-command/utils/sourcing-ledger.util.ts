import { type OutreachWorkingSetRow } from 'src/engine/core-modules/outreach-command/services/outreach-working-set.service';
import { readRowProfile } from 'src/engine/core-modules/candidate-sourcing/services/profile-fetch/profile-row-fields.util';

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
  // Spend the user approved, in USD
  capsUsd?: { fetch?: number; enrich?: number };
  destination?: string;
  // Defaults the agent chose and told the user about, instead of asking
  assumptions: string[];
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
  row: OutreachWorkingSetRow,
): 'pass' | 'unknown' | 'fail' | undefined => {
  const value =
    row.otherFields.fitmentOutcome ?? row.otherFields.fitment_outcome;

  return value === 'pass' || value === 'unknown' || value === 'fail'
    ? value
    : undefined;
};

export const computeSourcingFunnel = (
  rows: OutreachWorkingSetRow[],
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
