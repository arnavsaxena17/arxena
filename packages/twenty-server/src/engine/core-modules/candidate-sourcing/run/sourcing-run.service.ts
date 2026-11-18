import { Injectable, Logger, Optional } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { randomUUID } from 'crypto';

import { isNonEmptyString } from '@sniptt/guards';

import { BRIGHT_DATA_COST_PER_RECORD_USD } from 'src/engine/core-modules/bright-data/ludicrous/constants/bright-data-ludicrous-pricing.const';
import { countsTowardTarget } from 'src/engine/core-modules/candidate-sourcing/run/judge.util';
import {
  buildBroadenedQueries,
  DEFAULT_LOOP_SOURCES,
  estimateProbeCostUsd,
  normaliseQuery,
  planCandidates,
  unplannedSources,
} from 'src/engine/core-modules/candidate-sourcing/run/plan.util';
import {
  rankCandidates,
  splitBudget,
} from 'src/engine/core-modules/candidate-sourcing/run/select.util';
import { SourcingJudgeService } from 'src/engine/core-modules/candidate-sourcing/run/sourcing-judge.service';
import {
  isTerminalSourcingRunPhase,
  type SourcingCandidate,
  type SourcingFixKnob,
  type SourcingRunPhase,
  type SourcingRunQuestion,
  type SourcingRunState,
} from 'src/engine/core-modules/candidate-sourcing/run/sourcing-run.types';
import { shouldStop } from 'src/engine/core-modules/candidate-sourcing/run/stop.util';
import { shouldRetrySourceError } from 'src/engine/core-modules/candidate-sourcing/sources/registry';
import {
  SOURCING_TOOL_ADAPTERS,
  type SourcingToolCallPhase,
} from 'src/engine/core-modules/candidate-sourcing/sources/tool-adapters';
import { HARVEST_COST_PER_RECORD_USD } from 'src/engine/core-modules/org-chart/utils/harvest-search-params.util';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { SourcingSpecParserService } from 'src/engine/core-modules/linkedin-query-generation/services/sourcing-spec-parser.service';
import { OutreachTabService } from 'src/engine/core-modules/outreach-command/services/outreach-tab.service';
import { SourcingBudgetService } from 'src/engine/core-modules/outreach-command/services/sourcing-budget.service';
import { SourcingLedgerService } from 'src/engine/core-modules/outreach-command/services/sourcing-ledger.service';
import {
  mergeSourcingBrief,
  type SourcingBrief,
  type SourcingCoverage,
} from 'src/engine/core-modules/outreach-command/utils/sourcing-ledger.util';
import { isRejectedRow } from 'src/engine/core-modules/outreach-command/utils/sourcing-pool.util';
import { resolveSourcingSpec } from 'src/engine/core-modules/outreach-command/utils/sourcing-spec.util';
import { ToolRegistryService } from 'src/engine/core-modules/tool-provider/services/tool-registry.service';
import { FetchProfilesService } from 'src/engine/core-modules/tool/tools/fetch-profiles-tool/fetch-profiles.service';
import { type ToolOutput } from 'src/engine/core-modules/tool/types/tool-output.type';

export const SOURCING_ROUND_JOB_NAME = 'SourcingRoundJob';

export type SourcingRoundJobData = {
  workspaceId: string;
  projectId: string;
  runId: string;
  version: number;
};

// A round that has not written for this long has lost its worker; the next
// sourcing_next call queues it again
const STALE_RUN_MS = 10 * 60 * 1000;
// How long to wait before reading a background lookup again
const PENDING_RUN_POLL_DELAY_MS = 20_000;
// FIX may add or reorder at most this many times (docs/sourcing-loop.md)
const MAX_FIXES = 2;
// Profiles fetched per ENRICH round
const ENRICH_ROW_LIMIT = 100;
// A profile costs one Bright Data record, or one Harvest record when Bright
// Data does not have it; priced high so ENRICH never overruns the budget
const PROFILE_COST_USD = Math.max(
  BRIGHT_DATA_COST_PER_RECORD_USD,
  HARVEST_COST_PER_RECORD_USD,
);

export type SourcingStartInput = {
  workspaceId: string;
  projectId: string;
  request: string;
  budgetUsd: number;
  target?: number | null;
  coverage?: SourcingCoverage;
  sources?: string[];
  identity: SourcingRunState['identity'];
};

// What the chat model reads back; never the rows themselves
export type SourcingRunView = {
  runId: string;
  phase: SourcingRunPhase;
  done: boolean;
  question?: SourcingRunQuestion;
  target: number | null;
  qualified: number;
  toConfirm: number;
  spentUsd: number;
  budgetUsd: number;
  rounds: number;
  candidates: Array<{
    id: string;
    source: string;
    query: string;
    newRows: number;
    qualified: number;
    spentUsd: number;
    exhausted: boolean;
  }>;
  whyStopped?: SourcingRunState['whyStopped'];
  errors: string[];
  report?: string;
};

const YES_ANSWERS = new Set(['yes', 'y', 'confirm', 'ok', 'go', 'start']);
const NO_ANSWERS = new Set(['no', 'n', 'cancel', 'stop']);

const normalizeAnswer = (answer: unknown): string =>
  typeof answer === 'string'
    ? answer.trim().toLowerCase()
    : typeof answer === 'object' && answer !== null && 'value' in answer
      ? String((answer as { value: unknown }).value)
          .trim()
          .toLowerCase()
      : '';

@Injectable()
export class SourcingRunService {
  private readonly logger = new Logger(SourcingRunService.name);

  constructor(
    private readonly sourcingLedgerService: SourcingLedgerService,
    private readonly outreachTabService: OutreachTabService,
    private readonly sourcingJudgeService: SourcingJudgeService,
    private readonly sourcingSpecParserService: SourcingSpecParserService,
    private readonly moduleRef: ModuleRef,
    @InjectMessageQueue(MessageQueue.aiFilteringQueue)
    private readonly messageQueueService: MessageQueueService,
    @Optional()
    private readonly sourcingBudgetService?: SourcingBudgetService,
  ) {}

  // ToolModule and ToolProviderModule import this module's consumers, so the
  // registry and the profile fetch are looked up when a round runs
  private toolRegistry(): ToolRegistryService {
    return this.moduleRef.get(ToolRegistryService, { strict: false });
  }

  private fetchProfilesService(): FetchProfilesService {
    return this.moduleRef.get(FetchProfilesService, { strict: false });
  }

  // PLAN: parse the request, write the spec and the run cap on the brief, plan
  // the candidates and ask once. Nothing is spent before the answer.
  async start(input: SourcingStartInput): Promise<SourcingRunView> {
    const events = await this.sourcingLedgerService.read(
      input.workspaceId,
      input.projectId,
    );
    const previousBrief = [...events]
      .reverse()
      .find((event) => event.kind === 'brief') as
      | (SourcingBrief & { kind: 'brief' })
      | undefined;
    const parsedSpec = await this.sourcingSpecParserService.parse(
      input.request,
      { targetCount: input.target ?? null, budgetUsd: input.budgetUsd },
    );
    // The number and the budget the user gave win over what the parser read
    const specDraft = {
      ...parsedSpec,
      target: {
        ...parsedSpec.target,
        count: input.target ?? parsedSpec.target.count,
      },
      budgetUsd: input.budgetUsd,
    };
    const sources = input.sources ?? previousBrief?.sources;
    const budgetRunId = randomUUID();
    const brief = mergeSourcingBrief(previousBrief, {
      briefText: input.request,
      who: input.request.slice(0, 300),
      target: input.target ?? null,
      spec: specDraft,
      capsUsd: { run: input.budgetUsd },
      budgetRunId,
      ...(input.coverage !== undefined && { coverage: input.coverage }),
      ...(sources !== undefined && { sources }),
    });

    await this.sourcingLedgerService.append(
      input.workspaceId,
      input.projectId,
      {
        kind: 'brief',
        at: new Date().toISOString(),
        ...brief,
      },
    );
    await this.sourcingBudgetService?.configure({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      runCapUsd: input.budgetUsd,
      budgetRunId,
    });

    const spec = resolveSourcingSpec(brief);
    const candidates = planCandidates({
      spec,
      request: input.request,
      sources,
    });
    const now = new Date().toISOString();
    const state: SourcingRunState = {
      runId: randomUUID(),
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      phase: candidates.length === 0 ? 'BLOCKED' : 'PLANNED',
      request: input.request,
      spec,
      budgetUsd: input.budgetUsd,
      spentUsd: 0,
      qualified: 0,
      toConfirm: 0,
      candidates,
      selected: [],
      rounds: [],
      fixesUsed: 0,
      pendingJudgeRowIds: [],
      pendingEnrichRowIds: [],
      errors: [],
      identity: input.identity,
      startedAt: now,
      updatedAt: now,
      version: 0,
      ...(candidates.length === 0
        ? { whyStopped: 'no_candidates' as const }
        : { question: this.confirmQuestion(spec, candidates, sources, input) }),
    };

    return this.view(await this.save(state, 'PLANNED'));
  }

  private confirmQuestion(
    spec: SourcingRunState['spec'],
    candidates: SourcingCandidate[],
    sources: string[] | undefined,
    input: SourcingStartInput,
  ): SourcingRunQuestion {
    const list = (items: string[]) =>
      items.length > 0 ? items.join('; ') : 'none';
    const skipped = unplannedSources(sources);
    const text = [
      `Target: ${spec.target.count ?? 'as many as qualify'}${spec.coverage === 'exhaustive' ? ' (exhaustive)' : ''}.`,
      `Must have: ${list(spec.hard.map((constraint) => constraint.userWords))}.`,
      `Nice to have: ${list(spec.soft.map((constraint) => constraint.userWords))}.`,
      `Excluded: ${list(spec.exclusions.map((constraint) => constraint.userWords))}.`,
      `Sources: ${candidates.map((candidate) => candidate.source).join(', ')}.`,
      ...(skipped.length > 0
        ? [`Not searched yet by the loop: ${skipped.join(', ')}.`]
        : []),
      `Spend up to $${input.budgetUsd.toFixed(2)}; the first look costs at most $${estimateProbeCostUsd(candidates, spec).toFixed(2)}.`,
    ].join('\n');

    return {
      kind: 'confirm',
      text,
      options: [
        { value: 'yes', label: 'Start the search' },
        { value: 'no', label: 'Cancel' },
      ],
    };
  }

  async next({
    workspaceId,
    projectId,
    runId,
    answer,
  }: {
    workspaceId: string;
    projectId: string;
    runId: string;
    answer?: unknown;
  }): Promise<SourcingRunView | undefined> {
    const state = await this.load(workspaceId, projectId, runId);

    if (state === undefined) {
      return undefined;
    }

    const normalized = normalizeAnswer(answer);

    if (isTerminalSourcingRunPhase(state.phase)) {
      return this.view(state);
    }

    if (normalized === 'cancel') {
      return this.finish(state, 'CANCELLED', 'cancelled');
    }

    if (state.question?.kind === 'confirm') {
      if (YES_ANSWERS.has(normalized)) {
        const started = await this.save(
          { ...state, phase: 'PROBING', question: undefined },
          'PROBING',
        );

        await this.enqueue(started);

        return this.view(started);
      }

      if (NO_ANSWERS.has(normalized)) {
        return this.finish(state, 'CANCELLED', 'cancelled');
      }

      return this.view(state);
    }

    if (state.question?.kind === 'fix') {
      if (normalized === '') {
        return this.view(state);
      }

      return this.applyFix(state, normalized as SourcingFixKnob);
    }

    // A run whose worker is gone resumes from its last round
    if (Date.now() - Date.parse(state.updatedAt) > STALE_RUN_MS) {
      await this.enqueue(state);
    }

    return this.view(state);
  }

  // One round per job. The job queues the next one, so a run outlives the
  // chat turn and the queue lock, and resumes from the ledger after a crash.
  async runRound(job: SourcingRoundJobData): Promise<void> {
    const state = await this.load(job.workspaceId, job.projectId, job.runId);

    if (
      state === undefined ||
      state.version !== job.version ||
      isTerminalSourcingRunPhase(state.phase) ||
      state.question !== undefined
    ) {
      return;
    }

    try {
      const nextState = await this.save(await this.advance(state), state.phase);

      if (
        !isTerminalSourcingRunPhase(nextState.phase) &&
        nextState.question === undefined
      ) {
        const isWaiting = nextState.candidates.some((candidate) =>
          isNonEmptyString(candidate.pendingRunId),
        );

        await this.enqueue(
          nextState,
          isWaiting ? PENDING_RUN_POLL_DELAY_MS : undefined,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(`Sourcing run ${state.runId} round failed: ${message}`);
      await this.finish(
        { ...state, errors: [...state.errors, message].slice(-10) },
        'BLOCKED',
        'blocked',
      );
    }
  }

  private async advance(state: SourcingRunState): Promise<SourcingRunState> {
    switch (state.phase) {
      case 'PROBING':
        return this.probe(state);
      case 'SELECTED':
        return this.select(state);
      case 'FETCHING':
        return this.fetch(state);
      case 'JUDGING':
        return this.judge(state);
      case 'ENRICHING':
        return this.enrich(state);
      default:
        return state;
    }
  }

  // PROBE: the first page of every candidate, judged, so SELECT ranks on
  // qualified rows and not on counts
  private async probe(state: SourcingRunState): Promise<SourcingRunState> {
    let current = state;

    for (const candidate of state.candidates) {
      if (candidate.probe !== undefined || candidate.exhausted) {
        continue;
      }

      const outcome = await this.runCandidate(current, candidate, 'probe');
      const judged = await this.judgeRowIds(
        outcome.state,
        outcome.newRowIds,
        'snapshot',
      );

      current = this.credit(judged.state, candidate.id, judged.counted, true);
    }

    return { ...current, phase: 'SELECTED' };
  }

  // Adds a round's qualified rows to the candidate that fetched them; on a
  // probe it also fixes the numbers SELECT ranks by
  private credit(
    state: SourcingRunState,
    candidateId: string,
    counted: number,
    isProbe: boolean,
  ): SourcingRunState {
    return {
      ...state,
      candidates: state.candidates.map((candidate) =>
        candidate.id !== candidateId
          ? candidate
          : {
              ...candidate,
              qualified: candidate.qualified + counted,
              ...(isProbe && {
                probe: {
                  fetched: candidate.fetched,
                  newRows: candidate.newRows,
                  qualified: counted,
                  costUsd: candidate.spentUsd,
                },
              }),
            },
      ),
    };
  }

  private select(state: SourcingRunState): SourcingRunState {
    const ranked = rankCandidates(state.candidates);

    if (ranked.length === 0) {
      return this.stopState(state, 'SHORT', 'exhausted');
    }

    return {
      ...state,
      selected: ranked.map((candidate) => candidate.id),
      phase: 'FETCHING',
    };
  }

  // FETCH: the best live candidate, within its share of what is left
  private async fetch(state: SourcingRunState): Promise<SourcingRunState> {
    const live = state.selected
      .map((id) => state.candidates.find((candidate) => candidate.id === id))
      .filter(
        (candidate): candidate is SourcingCandidate =>
          candidate !== undefined && !candidate.exhausted,
      );
    const candidate = live[0];

    if (candidate === undefined) {
      return this.decide({ ...state, phase: 'JUDGING' });
    }

    const remainingUsd = Math.max(0, state.budgetUsd - state.spentUsd);
    const share = splitBudget(remainingUsd, live).get(candidate.id) ?? 0;
    const outcome = await this.runCandidate(state, candidate, 'fetch', share);

    // A background lookup still running: this round reads it again later
    if (
      isNonEmptyString(
        outcome.state.candidates.find((item) => item.id === candidate.id)
          ?.pendingRunId,
      )
    ) {
      return outcome.state;
    }

    return {
      ...outcome.state,
      pendingJudgeRowIds: outcome.newRowIds,
      phase: 'JUDGING',
      lastFetch: {
        candidateId: candidate.id,
        fetched: outcome.fetched,
        duplicates: Math.max(0, outcome.fetched - outcome.newRowIds.length),
        hasMorePages: outcome.hasMore,
      },
    };
  }

  private async judge(state: SourcingRunState): Promise<SourcingRunState> {
    const judged = await this.judgeRowIds(
      state,
      state.pendingJudgeRowIds,
      'snapshot',
    );
    const lastFetch = state.lastFetch;
    const credited =
      lastFetch === undefined
        ? judged.state
        : this.credit(
            judged.state,
            lastFetch.candidateId,
            judged.counted,
            false,
          );

    return this.decide({
      ...credited,
      pendingJudgeRowIds: [],
      lastFetch: undefined,
      rounds: [
        ...credited.rounds,
        {
          qualifiedAdded: judged.counted,
          fetched: lastFetch?.fetched ?? 0,
          duplicates: lastFetch?.duplicates ?? 0,
          hasMorePages: lastFetch?.hasMorePages ?? false,
        },
      ],
    });
  }

  // ENRICH: profiles for the rows the judge left open on the snapshot, then
  // judged again on the full profile. Never a row that failed.
  private async enrich(state: SourcingRunState): Promise<SourcingRunState> {
    const remainingUsd = Math.max(0, state.budgetUsd - state.spentUsd);
    const affordable = Math.min(
      ENRICH_ROW_LIMIT,
      Math.floor(remainingUsd / PROFILE_COST_USD),
    );
    const rowIds = state.pendingEnrichRowIds.slice(0, affordable);

    if (rowIds.length === 0) {
      return this.decide({ ...state, pendingEnrichRowIds: [] });
    }

    const result = await this.fetchProfilesService().fetch({
      workspaceId: state.workspaceId,
      projectId: state.projectId,
      rowIds,
      rowLimit: rowIds.length,
    });
    const costUsd =
      result.fetched.brightData * BRIGHT_DATA_COST_PER_RECORD_USD +
      result.fetched.harvest * HARVEST_COST_PER_RECORD_USD;

    await this.sourcingBudgetService?.recordSpend({
      workspaceId: state.workspaceId,
      projectId: state.projectId,
      usd: costUsd,
    });

    const judged = await this.judgeRowIds(
      { ...state, spentUsd: state.spentUsd + costUsd },
      rowIds,
      'full',
    );

    return this.decide({
      ...judged.state,
      // What the full profile still leaves open is the candidate's to answer
      pendingEnrichRowIds: state.pendingEnrichRowIds.slice(rowIds.length),
    });
  }

  // The stop rules, then the next round: ENRICH while open rows remain,
  // otherwise another FETCH. A short run gets the FIX question at most twice.
  private async decide(state: SourcingRunState): Promise<SourcingRunState> {
    const spentUsd = await this.currentSpend(state);
    const liveCandidates = state.selected.filter(
      (id) =>
        state.candidates.find((candidate) => candidate.id === id)?.exhausted ===
        false,
    ).length;
    const counted = state.qualified + state.toConfirm;
    const target = state.spec.target.count;
    const decision = shouldStop({
      target,
      qualified: counted,
      spentUsd,
      budgetUsd: state.budgetUsd,
      rounds: state.rounds,
      liveCandidates,
      coverage: state.spec.coverage,
    });
    const withSpend = { ...state, spentUsd };

    if (!decision.stop) {
      return {
        ...withSpend,
        phase:
          withSpend.pendingEnrichRowIds.length > 0 ? 'ENRICHING' : 'FETCHING',
      };
    }

    const isShort = target !== null && target > 0 && counted < target;

    // Rows still open for a profile may yet reach the target: settle them
    // before a dry source or a flat round ends the run
    if (
      decision.because !== 'budget' &&
      decision.because !== 'target_met' &&
      withSpend.pendingEnrichRowIds.length > 0
    ) {
      return { ...withSpend, phase: 'ENRICHING' };
    }

    if (
      isShort &&
      decision.because !== 'budget' &&
      withSpend.fixesUsed < MAX_FIXES
    ) {
      return {
        ...withSpend,
        phase: 'FIXING',
        question: this.fixQuestion(withSpend),
      };
    }

    return this.stopState(
      withSpend,
      isShort ? 'SHORT' : 'DONE',
      decision.because,
    );
  }

  // The first broadening the run has not asked the source for yet, if any
  private broaderQueryFor(state: SourcingRunState): string | undefined {
    const planned = new Set(
      state.candidates.map((candidate) => normaliseQuery(candidate.query)),
    );

    return buildBroadenedQueries(state.spec).find(
      (query) => !planned.has(normaliseQuery(query)),
    );
  }

  private fixQuestion(state: SourcingRunState): SourcingRunQuestion {
    const options: SourcingRunQuestion['options'] = [];
    const unusedSources = DEFAULT_LOOP_SOURCES.filter(
      (source) =>
        !state.candidates.some((candidate) => candidate.source === source),
    );

    if (unusedSources.length > 0) {
      options.push({
        value: 'add_source',
        label: `Also search ${unusedSources.join(', ')}`,
      });
    }

    if (this.broaderQueryFor(state) !== undefined) {
      options.push({
        value: 'broaden_titles',
        label: `Search equivalent titles too (${state.spec.normalized.titles.slice(0, 5).join(', ')})`,
      });
    }

    options.push({ value: 'stop', label: 'Stop here and report' });

    return {
      kind: 'fix',
      text: `${state.qualified} qualified and ${state.toConfirm} to confirm of ${state.spec.target.count ?? '?'} after ${state.rounds.length} rounds and $${state.spentUsd.toFixed(2)}. Pick one change, or stop.`,
      options,
    };
  }

  // FIX: one knob from the closed set; the stop rules still apply after it
  private async applyFix(
    state: SourcingRunState,
    knob: SourcingFixKnob,
  ): Promise<SourcingRunView> {
    if (knob === 'stop') {
      return this.finish(state, 'SHORT', 'flat');
    }

    let candidates = state.candidates;

    if (knob === 'add_source') {
      const extra = planCandidates({
        spec: state.spec,
        request: state.request,
        sources: DEFAULT_LOOP_SOURCES.filter(
          (source) =>
            !state.candidates.some((candidate) => candidate.source === source),
        ),
      }).map((candidate) => ({
        ...candidate,
        id: `${candidate.id}-fix${state.fixesUsed + 1}`,
      }));

      candidates = [...candidates, ...extra];
    } else if (knob === 'broaden_titles') {
      const broaderQuery = this.broaderQueryFor(state);
      const template = state.candidates.find(
        (candidate) => candidate.adapter === 'bright_data_people',
      );

      if (broaderQuery === undefined || template === undefined) {
        return this.view(state);
      }

      candidates = [
        ...candidates,
        {
          ...template,
          id: `${template.id}-fix${state.fixesUsed + 1}`,
          query: broaderQuery,
          fetched: 0,
          newRows: 0,
          qualified: 0,
          spentUsd: 0,
          exhausted: false,
          probe: undefined,
          cursor: undefined,
          lastError: undefined,
          pendingRunId: undefined,
        },
      ];
    } else {
      return this.view(state);
    }

    const fixed: SourcingRunState = {
      ...state,
      candidates,
      fixesUsed: state.fixesUsed + 1,
      // The flat streak that triggered the FIX is not held against the new
      // candidate; the round cap still counts every round
      phase: 'PROBING',
      question: undefined,
    };

    const saved = await this.save(fixed, 'FIXING');

    await this.enqueue(saved);

    return this.view(saved);
  }

  private async runCandidate(
    state: SourcingRunState,
    candidate: SourcingCandidate,
    phase: SourcingToolCallPhase,
    budgetUsd = 0,
  ): Promise<{
    state: SourcingRunState;
    newRowIds: string[];
    fetched: number;
    hasMore: boolean;
  }> {
    const adapter = SOURCING_TOOL_ADAPTERS[candidate.adapter];
    const before = await this.peopleIds(state);
    const call = adapter.build({
      phase,
      candidate,
      spec: state.spec,
      projectId: state.projectId,
      budgetUsd,
      remainingTarget:
        state.spec.target.count === null
          ? null
          : Math.max(
              0,
              state.spec.target.count - state.qualified - state.toConfirm,
            ),
    });

    let output: ToolOutput = { success: false, message: 'not run' };
    let reading = adapter.read(output, call);

    for (let attempt = 0; ; attempt++) {
      output = await this.toolRegistry().resolveAndExecute(
        call.toolName,
        call.args,
        {
          workspaceId: state.workspaceId,
          projectId: state.projectId,
          ...state.identity,
        },
      );
      reading = adapter.read(output, call);

      if (
        reading.error === undefined ||
        !shouldRetrySourceError(candidate.source, reading.error, attempt)
      ) {
        break;
      }
    }

    const after = await this.peopleIds(state);
    const newRowIds = [...after.live].filter((id) => !before.all.has(id));
    // A background lookup reports its running total; only the change is new
    const costUsd = isNonEmptyString(candidate.pendingRunId)
      ? Math.max(0, reading.costUsd - candidate.spentUsd)
      : reading.costUsd;
    const fetched = Math.max(
      newRowIds.length,
      Number((output.result as { fetched?: unknown } | undefined)?.fetched) ||
        0,
    );
    const updated: SourcingCandidate = {
      ...candidate,
      fetched: candidate.fetched + fetched,
      newRows: candidate.newRows + newRowIds.length,
      spentUsd: candidate.spentUsd + costUsd,
      cursor: (candidate.cursor ?? 0) + (Number(call.args.limit) || 0),
      pendingRunId: reading.pendingRunId,
      exhausted:
        reading.pendingRunId === undefined &&
        (reading.error !== undefined || !reading.hasMore),
      ...(reading.error !== undefined && {
        lastError: `${reading.error}: ${reading.errorMessage ?? ''}`.slice(
          0,
          300,
        ),
      }),
    };

    return {
      state: {
        ...state,
        spentUsd: state.spentUsd + costUsd,
        candidates: state.candidates.map((item) =>
          item.id === candidate.id ? updated : item,
        ),
        errors:
          reading.error !== undefined
            ? [...state.errors, `${candidate.id}: ${updated.lastError}`].slice(
                -10,
              )
            : state.errors,
      },
      newRowIds,
      fetched,
      hasMore: reading.hasMore,
    };
  }

  // Judges rows by id; counted is what the stop rules add toward the target
  private async judgeRowIds(
    state: SourcingRunState,
    rowIds: string[],
    level: 'snapshot' | 'full',
  ): Promise<{ state: SourcingRunState; counted: number }> {
    if (rowIds.length === 0) {
      return { state, counted: 0 };
    }

    const wanted = new Set(rowIds);
    const rows = (
      await this.outreachTabService.getAll({
        workspaceId: state.workspaceId,
        projectId: state.projectId,
        tab: 'people',
      })
    ).filter((row) => wanted.has(row.id) && !isRejectedRow(row));
    const run = await this.sourcingJudgeService.judgeRows({
      workspaceId: state.workspaceId,
      projectId: state.projectId,
      rows,
      spec: state.spec,
      level,
      request: state.request,
    });

    await this.sourcingBudgetService?.recordSpend({
      workspaceId: state.workspaceId,
      projectId: state.projectId,
      usd: run.costUsd,
    });

    // Only the snapshot sends rows on to a profile; on the full profile an
    // open flag belongs to the candidate
    const enrichable =
      level === 'snapshot'
        ? [...run.results.entries()]
            .filter(
              ([, result]) =>
                result.outcome === 'unknown' &&
                result.unsettled.some((open) => open.settledBy === 'profile'),
            )
            .map(([rowId]) => rowId)
        : [];
    const counted = [...run.results.values()].filter((result) =>
      countsTowardTarget(result.outcome),
    ).length;

    return {
      state: {
        ...state,
        spentUsd: state.spentUsd + run.costUsd,
        qualified: state.qualified + run.counts.qualified,
        toConfirm: state.toConfirm + run.counts.to_confirm,
        pendingEnrichRowIds: [
          ...new Set([...state.pendingEnrichRowIds, ...enrichable]),
        ],
      },
      counted,
    };
  }

  private async peopleIds(
    state: SourcingRunState,
  ): Promise<{ all: Set<string>; live: Set<string> }> {
    const rows = await this.outreachTabService.getAll({
      workspaceId: state.workspaceId,
      projectId: state.projectId,
      tab: 'people',
    });

    return {
      all: new Set(rows.map((row) => row.id)),
      live: new Set(
        rows.filter((row) => !isRejectedRow(row)).map((row) => row.id),
      ),
    };
  }

  // The budget service holds the run's spend as the paid tools record it; a
  // tool that bills without recording there (Bright Data writes its own rows)
  // is in the loop's own sum, so the larger of the two is what was spent
  private async currentSpend(state: SourcingRunState): Promise<number> {
    const status = await this.sourcingBudgetService
      ?.getStatus(state.workspaceId, state.projectId)
      .catch(() => undefined);

    return Math.max(status?.spentUsd ?? 0, state.spentUsd);
  }

  private stopState(
    state: SourcingRunState,
    phase: 'DONE' | 'SHORT',
    because: NonNullable<SourcingRunState['whyStopped']>,
  ): SourcingRunState {
    return { ...state, phase, whyStopped: because, question: undefined };
  }

  private async finish(
    state: SourcingRunState,
    phase: 'DONE' | 'SHORT' | 'BLOCKED' | 'CANCELLED',
    because: NonNullable<SourcingRunState['whyStopped']>,
  ): Promise<SourcingRunView> {
    const finished = {
      ...state,
      phase,
      whyStopped: because,
      question: undefined,
    };

    return this.view(await this.save(finished, phase));
  }

  private async enqueue(
    state: SourcingRunState,
    delay?: number,
  ): Promise<void> {
    await this.messageQueueService.add<SourcingRoundJobData>(
      SOURCING_ROUND_JOB_NAME,
      {
        workspaceId: state.workspaceId,
        projectId: state.projectId,
        runId: state.runId,
        version: state.version,
      },
      delay !== undefined ? { delay } : undefined,
    );
  }

  // Every round writes exactly one ledger row: the state after it
  private async save(
    state: SourcingRunState,
    round: SourcingRunPhase,
  ): Promise<SourcingRunState> {
    const saved: SourcingRunState = {
      ...state,
      version: state.version + 1,
      updatedAt: new Date().toISOString(),
    };

    await this.sourcingLedgerService.append(
      state.workspaceId,
      state.projectId,
      {
        kind: 'run',
        at: saved.updatedAt,
        runId: saved.runId,
        round,
        state: saved,
      },
    );

    return saved;
  }

  async load(
    workspaceId: string,
    projectId: string,
    runId: string,
  ): Promise<SourcingRunState | undefined> {
    const events = await this.sourcingLedgerService.read(
      workspaceId,
      projectId,
    );
    const latest = [...events]
      .reverse()
      .find((event) => event.kind === 'run' && event.runId === runId);

    return latest?.kind === 'run' ? latest.state : undefined;
  }

  view(state: SourcingRunState): SourcingRunView {
    const done = isTerminalSourcingRunPhase(state.phase);
    const target = state.spec.target.count;

    return {
      runId: state.runId,
      phase: state.phase,
      done,
      ...(state.question !== undefined && { question: state.question }),
      target,
      qualified: state.qualified,
      toConfirm: state.toConfirm,
      spentUsd: Number(state.spentUsd.toFixed(4)),
      budgetUsd: state.budgetUsd,
      rounds: state.rounds.length,
      candidates: state.candidates.map((candidate) => ({
        id: candidate.id,
        source: candidate.source,
        query: candidate.query.slice(0, 200),
        newRows: candidate.newRows,
        qualified: candidate.qualified,
        spentUsd: Number(candidate.spentUsd.toFixed(4)),
        exhausted: candidate.exhausted,
      })),
      ...(state.whyStopped !== undefined && { whyStopped: state.whyStopped }),
      errors: state.errors,
      ...(done && {
        report: `${state.qualified} qualified, ${state.toConfirm} to confirm${target !== null ? ` of ${target}` : ''}; $${state.spentUsd.toFixed(2)} of $${state.budgetUsd.toFixed(2)} over ${state.rounds.length} rounds. Stopped: ${state.whyStopped ?? state.phase.toLowerCase()}.`,
      }),
    };
  }
}
