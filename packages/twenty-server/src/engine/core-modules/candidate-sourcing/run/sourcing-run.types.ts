import {
  type SourcingRound,
  type SourcingStopReason,
} from 'src/engine/core-modules/candidate-sourcing/run/stop.util';
import { type SourcingSourceKey } from 'src/engine/core-modules/candidate-sourcing/sources/registry';
import { type SourcingSpec } from 'src/engine/core-modules/outreach-command/utils/sourcing-spec.util';

// docs/sourcing-loop.md, State. Two back-edges only: JUDGING -> ENRICHING ->
// JUDGING for undecided rows, JUDGING -> FIXING -> PROBING at most twice.
export type SourcingRunPhase =
  | 'PLANNED'
  | 'PROBING'
  | 'SELECTED'
  | 'FETCHING'
  | 'JUDGING'
  | 'ENRICHING'
  | 'FIXING'
  | 'DONE'
  | 'SHORT'
  | 'BLOCKED'
  | 'CANCELLED';

export const TERMINAL_SOURCING_RUN_PHASES: readonly SourcingRunPhase[] = [
  'DONE',
  'SHORT',
  'BLOCKED',
  'CANCELLED',
];

export const isTerminalSourcingRunPhase = (phase: SourcingRunPhase): boolean =>
  TERMINAL_SOURCING_RUN_PHASES.includes(phase);

// Which tool a candidate drives (see sources/tool-adapters.ts)
export type SourcingAdapterId = 'bright_data_people' | 'people_by_company';

// One (source, query) the loop can fetch from
export type SourcingCandidate = {
  id: string;
  source: SourcingSourceKey;
  adapter: SourcingAdapterId;
  query: string;
  // Rows and money this candidate has produced so far
  fetched: number;
  newRows: number;
  qualified: number;
  spentUsd: number;
  // Set from the first page; drives SELECT
  probe?: {
    fetched: number;
    newRows: number;
    qualified: number;
    costUsd: number;
    // The source's own total, kept only where the registry trusts it
    counts?: number;
    estimatedCostUsd?: number;
  };
  exhausted: boolean;
  // Paging cursor or offset for the next fetch
  cursor?: number;
  // A background run the adapter started (find_people_by_company)
  pendingRunId?: string;
  lastError?: string;
};

// The closed set FIX picks from; the model chooses one, code applies it
export type SourcingFixKnob = 'add_source' | 'broaden_titles' | 'stop';

export type SourcingRunQuestion = {
  kind: 'confirm' | 'fix';
  text: string;
  options: Array<{ value: string; label: string }>;
};

// The run as one value; every round writes it to the ledger as one row
export type SourcingRunState = {
  runId: string;
  workspaceId: string;
  projectId: string;
  phase: SourcingRunPhase;
  request: string;
  spec: SourcingSpec;
  budgetUsd: number;
  spentUsd: number;
  qualified: number;
  toConfirm: number;
  candidates: SourcingCandidate[];
  // Candidate ids in the order SELECT ranked them
  selected: string[];
  // Fetch rounds, for the stop rules
  rounds: SourcingRound[];
  fixesUsed: number;
  // Rows the last fetch added that the judge has not seen
  pendingJudgeRowIds: string[];
  // Rows the judge left open for a profile, waiting for ENRICH
  pendingEnrichRowIds: string[];
  // The fetch the next JUDGING round turns into a stop-rule round
  lastFetch?: {
    candidateId: string;
    fetched: number;
    duplicates: number;
    hasMorePages: boolean;
  };
  question?: SourcingRunQuestion;
  whyStopped?: SourcingStopReason | 'cancelled' | 'blocked' | 'no_candidates';
  errors: string[];
  // Who started the run, so its rounds act as the same member
  identity: {
    roleId: string;
    userId?: string;
    userWorkspaceId?: string;
    threadId?: string;
    turnId?: string;
  };
  startedAt: string;
  updatedAt: string;
  // Bumped by every round; a job for an older version is a duplicate
  version: number;
};
