import {
  type JudgeEnrichLevel,
  type JudgeOutcome,
} from 'src/domains/ingestion/candidate-sourcing/run/judge.util';
import { type FetchRoundStop } from 'src/domains/ingestion/candidate-sourcing/run/round.util';
import { type SourcingRound } from 'src/domains/ingestion/candidate-sourcing/run/stop.util';
import {
  type SourceSearchResult,
  type SourceSpec,
} from 'src/domains/ingestion/candidate-sourcing/sources/adapter';
import {
  type LinkedInSearchType,
  type SourceAlias,
} from 'src/domains/ingestion/candidate-sourcing/sources/registry';
import { type SourcingCoverage } from 'src/domains/engagement/outreach-command/utils/sourcing-ledger.util';

// One query the compiler produced, before it is aimed at a source
export type PlannedQuery = {
  label: string;
  keywords: string | null;
  jobTitle: string | null;
  companies: string[];
  locations: string[];
};

// One source x one query, with what the run has learnt about it so far
export type RunCandidate = {
  id: string;
  source: SourceAlias;
  searchType?: LinkedInSearchType;
  label: string;
  spec: SourceSpec;
  costPerPageUsd: number;
  pageSize: number;
  cursor?: string;
  pages: number;
  fetched: number;
  newUnique: number;
  // Rows the source says match; null until probed, or when it cannot be trusted
  available: number | null;
  // Whether it can still return new rows
  live: boolean;
  lastStop?: FetchRoundStop;
};

export type RunPhase =
  | 'PLANNED'
  | 'SELECTED'
  | 'DONE'
  | 'SHORT'
  | 'BLOCKED'
  | 'CANCELLED';

export type RunTally = Record<JudgeOutcome, number>;

export type RunState = {
  runId: string;
  workspaceId: string;
  projectId: string;
  phase: RunPhase;
  target: number | null;
  coverage: SourcingCoverage;
  budgetUsd: number;
  spentUsd: number;
  candidates: RunCandidate[];
  // What SELECT gave the next FETCH
  selected: Array<{ id: string; pages: number }>;
  // One entry per gathering round, read by the stop rules
  rounds: SourcingRound[];
  tally: RunTally;
  // FIX rounds used, at most two
  fixes: number;
  whyStopped?: string;
  // The fitment column the judge runs: one preview for rows as searched, and
  // optionally one for rows that have a full profile
  scoring?: { previewId: string; profilePreviewId?: string };
};

export type RunRoundName =
  | 'plan'
  | 'probe'
  | 'split'
  | 'fetch'
  | 'judge'
  | 'enrich'
  | 'select'
  | 'fix'
  | 'stop';

// What the agent sees: nothing it has to compute, nothing it has to decide
export type RunView = {
  runId: string;
  done: boolean;
  phase: RunPhase;
  target: number | null;
  qualified: number;
  toConfirm: number;
  unknown: number;
  failed: number;
  spentUsd: number;
  budgetUsd: number;
  rounds: number;
  whyStopped?: string;
  candidates: Array<{
    id: string;
    source: SourceAlias;
    label: string;
    fetched: number;
    newUnique: number;
    available: number | null;
    live: boolean;
  }>;
  // Sources the brief named that the run cannot use, and why
  unusable?: Array<{ source: string; reason: string }>;
};

export type JudgedRow = {
  rowId: string;
  outcome: JudgeOutcome;
  enrich: JudgeEnrichLevel[];
};

export type EnrichmentStep = {
  level: JudgeEnrichLevel;
  rowIds: string[];
  costUsd: number;
};

// Everything outside the loop that the loop needs. The loop itself holds no
// provider, model or storage knowledge.
export type SourcingRunPorts = {
  // PLAN: the brief as queries, from the Python compiler. Free.
  compile: (brief: {
    who: string;
    briefText?: string;
  }) => Promise<PlannedQuery[]>;
  // PROBE / FETCH: one page of one candidate, through its source adapter,
  // which also writes the page to the project tab
  search: (
    candidate: RunCandidate,
    request: { page: number; cursor: string | undefined },
  ) => Promise<SourceSearchResult>;
  // PLAN: why a source cannot run a spec, when it cannot (no adapter, or a
  // filter it cannot express)
  rejects?: (source: SourceAlias, spec: SourceSpec) => string | undefined;
  // JUDGE: per-flag verdicts on every row not yet judged (or re-judged after
  // an enrichment), rolled up by judgeRow
  judge: (state: Pick<RunState, 'workspaceId' | 'projectId'>) => Promise<{
    rows: JudgedRow[];
    costUsd: number;
  }>;
  // The project's rows as they stand now, by outcome
  tally: (
    state: Pick<RunState, 'workspaceId' | 'projectId'>,
  ) => Promise<RunTally>;
  // ENRICH: profiles or company web columns for the rows named, nothing else
  enrich: (
    state: Pick<RunState, 'workspaceId' | 'projectId'>,
    step: EnrichmentStep,
  ) => Promise<{ costUsd: number }>;
  // PLAN, again: a candidate too large for one search as smaller ones
  split?: (candidate: RunCandidate) => Promise<SourceSpec[]>;
  // FIX: one new candidate from a closed set of knobs, or null for none
  fix?: (state: RunState) => Promise<{
    source: string;
    searchType?: LinkedInSearchType;
    query: PlannedQuery;
    knob: string;
  } | null>;
};
