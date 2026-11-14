import { randomUUID } from 'node:crypto';

import { planEnrichment } from 'src/domains/ingestion/candidate-sourcing/run/enrich.util';
import {
  needsSplit,
  planCandidates,
  splitCandidate,
} from 'src/domains/ingestion/candidate-sourcing/run/plan.util';
import {
  canFetchMore,
  runFetchRound,
} from 'src/domains/ingestion/candidate-sourcing/run/round.util';
import { selectCandidates } from 'src/domains/ingestion/candidate-sourcing/run/select.util';
import {
  type RunCandidate,
  type RunRoundName,
  type RunState,
  type RunTally,
  type RunView,
  type SourcingRunPorts,
} from 'src/domains/ingestion/candidate-sourcing/run/sourcing-run.types';
import {
  SOURCING_STOP_EXHAUSTED_DUPLICATE_SHARE,
  shouldStop,
  type SourcingStopReason,
} from 'src/domains/ingestion/candidate-sourcing/run/stop.util';
import {
  actionForSourceError,
  roundUsd,
  type SourceErrorCode,
} from 'src/domains/ingestion/candidate-sourcing/sources/adapter';
import {
  SOURCE_REGISTRY,
  isSourceCountReliable,
  type LinkedInSearchType,
} from 'src/domains/ingestion/candidate-sourcing/sources/registry';
import {
  type SourcingBrief,
  type SourcingLedgerEvent,
} from 'src/domains/engagement/outreach-command/utils/sourcing-ledger.util';

// The existing ledger, as much of it as the loop needs
export type SourcingRunLedger = {
  read: (
    workspaceId: string,
    projectId: string,
  ) => Promise<SourcingLedgerEvent[]>;
  append: (
    workspaceId: string,
    projectId: string,
    event: SourcingLedgerEvent,
  ) => Promise<void>;
};

const MAX_FIXES = 2;
const SEARCH_ATTEMPTS = 3;
const TERMINAL_PHASES: ReadonlyArray<RunState['phase']> = [
  'DONE',
  'SHORT',
  'BLOCKED',
  'CANCELLED',
];

const EMPTY_TALLY: RunTally = {
  qualified: 0,
  unknown: 0,
  to_confirm: 0,
  fail: 0,
};

const towardTarget = (tally: RunTally): number =>
  tally.qualified + tally.to_confirm;

const isRunState = (value: unknown): value is RunState =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as RunState).runId === 'string' &&
  Array.isArray((value as RunState).candidates);

const viewOf = (state: RunState, unusable?: RunView['unusable']): RunView => ({
  runId: state.runId,
  done: TERMINAL_PHASES.includes(state.phase),
  phase: state.phase,
  target: state.target,
  qualified: state.tally.qualified,
  toConfirm: state.tally.to_confirm,
  unknown: state.tally.unknown,
  failed: state.tally.fail,
  spentUsd: state.spentUsd,
  budgetUsd: state.budgetUsd,
  rounds: state.rounds.length,
  ...(state.whyStopped !== undefined && { whyStopped: state.whyStopped }),
  candidates: state.candidates.map((candidate) => ({
    id: candidate.id,
    source: candidate.source,
    label: candidate.label,
    fetched: candidate.fetched,
    newUnique: candidate.newUnique,
    available: candidate.available,
    live: candidate.live,
  })),
  ...(unusable !== undefined && unusable.length > 0 && { unusable }),
});

// start plans and spends nothing. next runs one round: gather (probe, or
// fetch what was selected), judge, enrich the undecided, then either stop or
// select what the next round fetches. Every decision here is arithmetic; the
// model is only asked through the ports, and only for judgement.
//
// One is made per tool call: the ports act as the calling user, so they are
// built from that call's context and cannot be a singleton.
export class SourcingRunService {
  constructor(
    private readonly ledger: SourcingRunLedger,
    private readonly ports: SourcingRunPorts,
  ) {}

  async start({
    workspaceId,
    projectId,
    brief,
    budgetUsd,
    searchType,
    scoring,
  }: {
    workspaceId: string;
    projectId: string;
    brief: SourcingBrief;
    budgetUsd: number;
    // Which LinkedIn product the connected account searches, when a LinkedIn
    // source is picked
    searchType?: LinkedInSearchType;
    scoring?: RunState['scoring'];
  }): Promise<RunView> {
    const queries = await this.ports.compile({
      who: brief.who,
      ...(brief.briefText !== undefined && { briefText: brief.briefText }),
    });
    const plan = planCandidates({
      queries,
      sources: brief.sources ?? [],
      ...(this.ports.rejects !== undefined && {
        rejects: this.ports.rejects,
      }),
      ...(searchType !== undefined && { searchType }),
    });
    const state: RunState = {
      runId: randomUUID(),
      workspaceId,
      projectId,
      phase: 'PLANNED',
      target: brief.target,
      coverage: brief.coverage ?? 'best_effort',
      budgetUsd,
      spentUsd: 0,
      candidates: plan.candidates,
      selected: [],
      rounds: [],
      tally: { ...EMPTY_TALLY },
      fixes: 0,
      ...(scoring !== undefined && { scoring }),
    };

    if (plan.candidates.length === 0) {
      state.phase = 'BLOCKED';
      state.whyStopped =
        queries.length === 0
          ? 'The brief did not compile into any query.'
          : 'None of the picked sources can be run.';
    } else if (!(budgetUsd > 0) && plan.candidates.every(this.isPaid)) {
      state.phase = 'BLOCKED';
      state.whyStopped = 'Every picked source costs money and the budget is 0.';
    }

    await this.record(
      state,
      'plan',
      0,
      `${plan.candidates.length} candidates from ${queries.length} queries`,
    );

    return viewOf(state, plan.unusable);
  }

  async next({
    workspaceId,
    projectId,
    runId,
  }: {
    workspaceId: string;
    projectId: string;
    runId: string;
  }): Promise<RunView> {
    const state = await this.load(workspaceId, projectId, runId);

    if (TERMINAL_PHASES.includes(state.phase)) {
      return viewOf(state);
    }

    const before = towardTarget(state.tally);
    const gathered = await this.gather(state);

    await this.judgeAndEnrich(state);

    state.rounds.push({
      qualifiedAdded: Math.max(0, towardTarget(state.tally) - before),
      fetched: gathered.fetched,
      duplicates: gathered.fetched - gathered.newUnique,
      hasMorePages: state.candidates.some((candidate) => candidate.live),
    });

    await this.stopOrSelect(state);

    return viewOf(state);
  }

  async cancel({
    workspaceId,
    projectId,
    runId,
  }: {
    workspaceId: string;
    projectId: string;
    runId: string;
  }): Promise<RunView> {
    const state = await this.load(workspaceId, projectId, runId);

    if (!TERMINAL_PHASES.includes(state.phase)) {
      state.phase = 'CANCELLED';
      state.whyStopped = 'Cancelled.';
      await this.record(state, 'stop', 0, 'cancelled');
    }

    return viewOf(state);
  }

  private readonly isPaid = (candidate: RunCandidate): boolean =>
    candidate.costPerPageUsd > 0;

  private canAfford(state: RunState, costUsd: number): boolean {
    // A free call is always affordable; a paid one must fit what is left
    return costUsd <= 0 || state.spentUsd + costUsd <= state.budgetUsd + 1e-9;
  }

  private spend(state: RunState, costUsd: number): void {
    state.spentUsd = roundUsd(state.spentUsd + Math.max(0, costUsd));
  }

  // PROBE the candidates never run, else FETCH what SELECT chose
  private async gather(
    state: RunState,
  ): Promise<{ fetched: number; newUnique: number }> {
    const total = { fetched: 0, newUnique: 0 };
    const add = (result: { fetched: number; newUnique: number }): void => {
      total.fetched += result.fetched;
      total.newUnique += result.newUnique;
    };
    const unprobed = (): RunCandidate[] =>
      state.candidates.filter(
        (candidate) => candidate.live && candidate.pages === 0,
      );

    if (unprobed().length > 0) {
      const spentBefore = state.spentUsd;

      for (const candidate of unprobed()) {
        add(await this.runCandidate(state, candidate, 1));
      }

      await this.record(
        state,
        'probe',
        state.spentUsd - spentBefore,
        `${total.fetched} rows, ${total.newUnique} new`,
      );

      // A candidate too large for one search is replaced by smaller ones,
      // which are probed in turn
      const parts = await this.split(state);

      if (parts.length > 0) {
        const spentBeforeParts = state.spentUsd;
        const partTotal = { fetched: 0, newUnique: 0 };

        for (const candidate of parts) {
          const result = await this.runCandidate(state, candidate, 1);

          add(result);
          partTotal.fetched += result.fetched;
          partTotal.newUnique += result.newUnique;
        }

        await this.record(
          state,
          'probe',
          state.spentUsd - spentBeforeParts,
          `${partTotal.fetched} rows, ${partTotal.newUnique} new (split candidates)`,
        );
      }

      return total;
    }

    const spentBefore = state.spentUsd;

    for (const { id, pages } of state.selected) {
      const candidate = state.candidates.find((entry) => entry.id === id);

      if (candidate !== undefined && candidate.live) {
        add(await this.runCandidate(state, candidate, pages));
      }
    }

    state.selected = [];
    await this.record(
      state,
      'fetch',
      state.spentUsd - spentBefore,
      `${total.fetched} rows, ${total.newUnique} new`,
    );

    return total;
  }

  private async split(state: RunState): Promise<RunCandidate[]> {
    const split = this.ports.split;

    if (split === undefined) {
      return [];
    }

    const created: RunCandidate[] = [];

    for (const candidate of [...state.candidates]) {
      if (
        !candidate.live ||
        !needsSplit(
          candidate,
          SOURCE_REGISTRY[candidate.source].maxRowsPerSearch,
        )
      ) {
        continue;
      }

      const parts = splitCandidate(candidate, await split(candidate));

      if (parts.length < 2) {
        continue;
      }

      // The whole is retired: its parts cover it
      candidate.live = false;
      state.candidates.push(...parts);
      created.push(...parts);
    }

    if (created.length > 0) {
      await this.record(
        state,
        'split',
        0,
        `${created.length} smaller candidates`,
      );
    }

    return created;
  }

  // One candidate, up to maxPages more pages, within the budget
  private async runCandidate(
    state: RunState,
    candidate: RunCandidate,
    maxPages: number,
  ): Promise<{ fetched: number; newUnique: number }> {
    const descriptor = SOURCE_REGISTRY[candidate.source];
    const isCountReliable = isSourceCountReliable(
      candidate.source,
      candidate.searchType,
    );
    let newUnique = 0;
    let failure: SourceErrorCode | undefined;

    // The rows are on the project tab, deduplicated there. The round only
    // needs to count them, so each one stands in as its own key.
    const round = await runFetchRound<string>({
      keyOf: (key) => key,
      pageSize: candidate.pageSize,
      maxPages,
      resumeFrom: {
        page: candidate.pages + 1,
        cursor: candidate.cursor,
        ...(candidate.available !== null && { counts: candidate.available }),
      },
      // Invariant 2: the one budget, checked before every paid call
      isAborted: () => !this.canAfford(state, candidate.costPerPageUsd),
      fetchPage: async (request) => {
        for (let attempt = 1; attempt <= SEARCH_ATTEMPTS; attempt += 1) {
          const result = await this.ports.search(candidate, request);

          this.spend(state, result.costUsd);

          if (result.error === undefined) {
            newUnique += result.newUnique;

            return {
              items: Array.from(
                { length: result.fetched },
                (_unused, index) => `${request.page}:${index}`,
              ),
              ...(isCountReliable &&
                result.counts !== undefined && { counts: result.counts }),
              hasMore: result.nextCursor !== undefined,
              ...(result.nextCursor !== undefined && {
                cursor: result.nextCursor,
              }),
            };
          }

          failure = result.error;

          const canRetry =
            actionForSourceError(result.error, descriptor.retryPolicy) ===
              'retry' &&
            attempt < SEARCH_ATTEMPTS &&
            this.canAfford(state, candidate.costPerPageUsd);

          if (!canRetry) {
            return null;
          }
        }

        return null;
      },
    });

    candidate.pages += round.pages;
    candidate.fetched += round.fetched;
    candidate.newUnique += newUnique;
    candidate.cursor = round.cursor;
    candidate.lastStop = round.stoppedBecause;

    if (round.counts !== undefined) {
      candidate.available = round.counts;
    }

    const failureAction =
      failure === undefined
        ? undefined
        : actionForSourceError(failure, descriptor.retryPolicy);
    // Mostly rows the project already has: this query has little left to give
    const isMostlyKnown =
      round.fetched > 0 &&
      (round.fetched - newUnique) / round.fetched >
        SOURCING_STOP_EXHAUSTED_DUPLICATE_SHARE;

    candidate.live =
      failureAction === 'drop'
        ? false
        : failureAction !== undefined
          ? // Deferred, rate limited or out of budget: it may still have rows
            true
          : canFetchMore(round.stoppedBecause) && !isMostlyKnown;

    return { fetched: round.fetched, newUnique };
  }

  // JUDGE the new rows, ENRICH only the undecided, then judge those again
  private async judgeAndEnrich(state: RunState): Promise<void> {
    if (state.spentUsd >= state.budgetUsd && state.budgetUsd > 0) {
      state.tally = await this.ports.tally(state);

      return;
    }

    const judged = await this.ports.judge(state);

    this.spend(state, judged.costUsd);
    await this.record(
      state,
      'judge',
      judged.costUsd,
      `${judged.rows.length} rows judged`,
    );

    // Invariant 8: nothing is enriched before it is judged, and only rows
    // that came back unknown are queued
    const plan = planEnrichment({
      rows: judged.rows,
      budgetUsd: state.budgetUsd - state.spentUsd,
    });

    if (plan.steps.length > 0) {
      let enrichCostUsd = 0;

      for (const step of plan.steps) {
        const { costUsd } = await this.ports.enrich(state, step);

        enrichCostUsd += costUsd;
        this.spend(state, costUsd);
      }

      await this.record(
        state,
        'enrich',
        enrichCostUsd,
        `${plan.steps.reduce((total, step) => total + step.rowIds.length, 0)} rows enriched, ${plan.unfunded} left for lack of budget`,
      );

      const rejudged = await this.ports.judge(state);

      this.spend(state, rejudged.costUsd);
      await this.record(
        state,
        'judge',
        rejudged.costUsd,
        `${rejudged.rows.length} rows judged again`,
      );
    }

    state.tally = await this.ports.tally(state);
  }

  private async stopOrSelect(state: RunState): Promise<void> {
    const decision = shouldStop({
      target: state.target,
      qualified: towardTarget(state.tally),
      spentUsd: state.spentUsd,
      budgetUsd: state.budgetUsd,
      rounds: state.rounds,
      liveCandidates: state.candidates.filter((candidate) => candidate.live)
        .length,
      coverage: state.coverage,
    });

    if (decision.stop) {
      // FIX answers a run that is flat or dry. It never overrides the target,
      // the budget or the round cap.
      if (
        (decision.because === 'flat' || decision.because === 'exhausted') &&
        (await this.fix(state))
      ) {
        return;
      }

      await this.finish(state, decision.because);

      return;
    }

    const live = state.candidates.filter((candidate) => candidate.live);
    const selected = selectCandidates({
      candidates: live.map((candidate) => ({
        id: candidate.id,
        costPerPageUsd: candidate.costPerPageUsd,
        pageSize: candidate.pageSize,
        available: candidate.available,
        fetched: candidate.fetched,
        newUnique: candidate.newUnique,
      })),
      budgetUsd: state.budgetUsd - state.spentUsd,
      need:
        state.coverage === 'exhaustive' || state.target === null
          ? null
          : state.target - towardTarget(state.tally),
    });

    if (selected.length === 0) {
      // Live candidates exist but none is worth a page, or none is affordable
      await this.finish(
        state,
        live.every(this.isPaid) ? 'budget' : 'exhausted',
      );

      return;
    }

    state.selected = selected.map(({ id, pages }) => ({ id, pages }));
    state.phase = 'SELECTED';
    await this.record(
      state,
      'select',
      0,
      selected.map((entry) => `${entry.id} x${entry.pages}`).join(', '),
    );
  }

  private async fix(state: RunState): Promise<boolean> {
    const isShort =
      state.coverage !== 'exhaustive' &&
      state.target !== null &&
      towardTarget(state.tally) < state.target;

    if (
      !isShort ||
      state.fixes >= MAX_FIXES ||
      this.ports.fix === undefined ||
      state.spentUsd >= state.budgetUsd
    ) {
      return false;
    }

    const proposal = await this.ports.fix(state);

    if (proposal === null) {
      return false;
    }

    const { candidates } = planCandidates({
      queries: [proposal.query],
      sources: [proposal.source],
      ...(proposal.searchType !== undefined && {
        searchType: proposal.searchType,
      }),
      idPrefix: `fix${state.fixes + 1}-`,
    });

    if (candidates.length === 0) {
      return false;
    }

    // One knob, one candidate: the next round probes it
    state.fixes += 1;
    state.candidates.push(candidates[0]);
    state.phase = 'PLANNED';
    await this.record(state, 'fix', 0, proposal.knob);

    return true;
  }

  private async finish(
    state: RunState,
    because: SourcingStopReason,
  ): Promise<void> {
    const reached = towardTarget(state.tally);
    const isShort =
      state.coverage !== 'exhaustive' &&
      state.target !== null &&
      reached < state.target;

    state.phase = isShort ? 'SHORT' : 'DONE';
    state.selected = [];
    state.whyStopped = because;
    await this.ledger.append(state.workspaceId, state.projectId, {
      kind: 'stop',
      at: new Date().toISOString(),
      target: state.target,
      qualified: reached,
      because,
    });
    await this.record(state, 'stop', 0, because);
  }

  // Invariant 3: one ledger row per round, carrying the state the next round
  // starts from
  private async record(
    state: RunState,
    round: RunRoundName,
    costUsd: number,
    note: string,
  ): Promise<void> {
    await this.ledger.append(state.workspaceId, state.projectId, {
      kind: 'round',
      at: new Date().toISOString(),
      runId: state.runId,
      round,
      costUsd: roundUsd(costUsd),
      note,
      state: structuredClone(state) as unknown as Record<string, unknown>,
    });
  }

  private load(
    workspaceId: string,
    projectId: string,
    runId: string,
  ): Promise<RunState> {
    return readRunState(this.ledger, workspaceId, projectId, runId);
  }
}

// The state a run's latest round left in the ledger
export const readRunState = async (
  ledger: Pick<SourcingRunLedger, 'read'>,
  workspaceId: string,
  projectId: string,
  runId: string,
): Promise<RunState> => {
  const events = await ledger.read(workspaceId, projectId);

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];

    if (
      event.kind === 'round' &&
      event.runId === runId &&
      isRunState(event.state)
    ) {
      return structuredClone(event.state);
    }
  }

  throw new Error(`No sourcing run ${runId} on this project`);
};
