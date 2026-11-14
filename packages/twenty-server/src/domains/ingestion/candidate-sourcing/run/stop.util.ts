import { type SourcingCoverage } from 'src/domains/engagement/outreach-command/utils/sourcing-ledger.util';

// The numbers the sourcing-playbook-shortfall skill states in prose. They live
// here so the server decides when a run ends, not the model.
export const SOURCING_STOP_FLAT_SHARE_OF_TARGET = 0.05;
export const SOURCING_STOP_FLAT_ROUNDS_IN_A_ROW = 2;
export const SOURCING_STOP_MAX_ROUNDS = 5;
export const SOURCING_STOP_EXHAUSTED_DUPLICATE_SHARE = 0.8;

export type SourcingRound = {
  // Rows that became qualified because of this round
  qualifiedAdded: number;
  fetched: number;
  duplicates: number;
  hasMorePages: boolean;
};

export type SourcingStopState = {
  // null when the user gave no number
  target: number | null;
  qualified: number;
  spentUsd: number;
  budgetUsd: number;
  rounds: SourcingRound[];
  // Candidates that can still return new rows. A FIX round adds to this.
  liveCandidates: number;
  coverage?: SourcingCoverage;
};

export type SourcingStopReason =
  | 'target_met'
  | 'budget'
  | 'exhausted'
  | 'flat'
  | 'rounds';

export type SourcingStopDecision =
  | { stop: false }
  | { stop: true; because: SourcingStopReason };

// A candidate that returned nothing, mostly known rows, or its last page has
// no new rows left to give for this query
export const isRoundExhausted = (round: SourcingRound): boolean =>
  !round.hasMorePages ||
  round.fetched === 0 ||
  round.duplicates / round.fetched > SOURCING_STOP_EXHAUSTED_DUPLICATE_SHARE;

const isRoundFlat = (round: SourcingRound, target: number | null): boolean =>
  // Without a target there is no 5% to measure against, so flat means a
  // round that qualified nobody
  target === null || target <= 0
    ? round.qualifiedAdded < 1
    : round.qualifiedAdded < target * SOURCING_STOP_FLAT_SHARE_OF_TARGET;

export const shouldStop = (state: SourcingStopState): SourcingStopDecision => {
  // An exhaustive run ends when the universe is covered or the cap is hit;
  // reaching the target, a flat round or the round count do not end it
  const isBestEffort = state.coverage !== 'exhaustive';

  if (
    isBestEffort &&
    state.target !== null &&
    state.target > 0 &&
    state.qualified >= state.target
  ) {
    return { stop: true, because: 'target_met' };
  }

  if (state.spentUsd >= state.budgetUsd) {
    return { stop: true, because: 'budget' };
  }

  if (state.rounds.length > 0 && state.liveCandidates <= 0) {
    return { stop: true, because: 'exhausted' };
  }

  if (!isBestEffort) {
    return { stop: false };
  }

  const lastRounds = state.rounds.slice(-SOURCING_STOP_FLAT_ROUNDS_IN_A_ROW);

  if (
    lastRounds.length === SOURCING_STOP_FLAT_ROUNDS_IN_A_ROW &&
    lastRounds.every((round) => isRoundFlat(round, state.target))
  ) {
    return { stop: true, because: 'flat' };
  }

  if (state.rounds.length >= SOURCING_STOP_MAX_ROUNDS) {
    return { stop: true, because: 'rounds' };
  }

  return { stop: false };
};
