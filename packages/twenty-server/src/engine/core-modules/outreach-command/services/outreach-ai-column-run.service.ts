import { Injectable, Logger, Optional } from '@nestjs/common';

import { randomUUID } from 'crypto';

import { isDefined } from 'twenty-shared/utils';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import {
  type OutreachAiColumnFilter,
  type OutreachAiColumnRowResult,
  type OutreachAiColumnUsage,
  OutreachAiColumnService,
  companyGroupKey,
  humanizeKey,
  shouldGroupByCompany,
} from 'src/engine/core-modules/outreach-command/services/outreach-ai-column.service';
import { type OutreachSampleMessageInclude } from 'src/engine/core-modules/outreach-command/types/outreach-sample-message.types';
import {
  matchesTableFilter,
  OutreachTableViewService,
  readCellText,
} from 'src/engine/core-modules/outreach-command/services/outreach-table-view.service';
import { ChatTabWritesService } from 'src/engine/core-modules/outreach-command/services/chat-tab-writes.service';
import { SourcingLedgerService } from 'src/engine/core-modules/outreach-command/services/sourcing-ledger.service';
import {
  CHUNKED_RUN_TERMINAL_STATUSES,
  type ChunkedRunStatus,
  isChunkedRunStalled,
  waitForChunkedRun,
} from 'src/engine/core-modules/outreach-command/utils/chunked-run.util';
import { computeSourcingFunnel } from 'src/engine/core-modules/outreach-command/utils/sourcing-ledger.util';
import { OutreachCacheRealtimeService } from 'src/engine/core-modules/outreach-command/services/outreach-cache-realtime.service';
import {
  type OutreachTabRow,
  OutreachTabService,
} from 'src/engine/core-modules/outreach-command/services/outreach-tab.service';
import { type AiColumnRowScope } from 'src/engine/core-modules/outreach-command/types/ai-column-row-scope.type';
import { isAiColumnFilled } from 'src/engine/core-modules/outreach-command/utils/ai-column-filled.util';
import { type OutreachTableTab } from 'src/engine/core-modules/outreach-command/utils/outreach-cache-realtime.constants';

export const OUTREACH_AI_COLUMN_CHUNK_JOB_NAME =
  'ProcessOutreachAiColumnChunkJob';

export type OutreachAiColumnChunkJobData = {
  runId: string;
};

export type OutreachAiColumnRunStatus = ChunkedRunStatus;

type RunState = {
  runId: string;
  workspaceId: string;
  projectId: string;
  tab: OutreachTableTab;
  previewId: string;
  filter: OutreachAiColumnFilter;
  status: OutreachAiColumnRunStatus;
  total: number;
  done: number;
  answered: number;
  failed: number;
  // Row ids still to evaluate, grouped so rows that share one web lookup
  // (same employer) always land in the same chunk.
  units: string[][];
  unitCursor: number;
  // Rows already answered by the preview: written with the first chunk.
  precomputedIds: string[];
  failures: Array<{ id: string; name: string; error?: string }>;
  usage: OutreachAiColumnUsage | null;
  written: { ephemeralUpdated: number; crmUpdated: number };
  cancelRequested: boolean;
  error?: string;
  startedAt: string;
  // Last time a chunk finished; a run that stops moving is stalled
  updatedAt?: string;
  finishedAt?: string;
};

type RowSnapshot = Record<string, OutreachTabRow>;

// CacheStorageService takes milliseconds.
const RUN_TTL_MS = 24 * 60 * 60 * 1000;
// Rows evaluated per queue job. Small enough that other AI filtering jobs on
// the same queue are never blocked for long, large enough to batch writes.
const UNITS_PER_CHUNK = 20;
const isStalled = (state: RunState): boolean => isChunkedRunStalled(state);

const isQuotaError = (message: string | undefined): boolean =>
  /credit_balance_exhausted|insufficient_quota|credits are exhausted/i.test(
    message ?? '',
  );

@Injectable()
export class OutreachAiColumnRunService {
  private readonly logger = new Logger(OutreachAiColumnRunService.name);

  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineOutreachCommand)
    private readonly cache: CacheStorageService,
    @InjectMessageQueue(MessageQueue.aiFilteringQueue)
    private readonly messageQueueService: MessageQueueService,
    private readonly outreachAiColumnService: OutreachAiColumnService,
    private readonly outreachTabService: OutreachTabService,
    private readonly outreachCacheRealtimeService: OutreachCacheRealtimeService,
    private readonly outreachTableViewService: OutreachTableViewService,
    @Optional()
    private readonly sourcingLedgerService?: SourcingLedgerService,
    @Optional()
    private readonly chatTabWritesService?: ChatTabWritesService,
  ) {}

  async startSampleLinkedinMessageForSelection({
    workspaceId,
    projectId,
    rowIds,
    include,
  }: {
    workspaceId: string;
    projectId: string;
    rowIds: string[];
    include?: OutreachSampleMessageInclude;
  }): Promise<RunState> {
    if (rowIds.length === 0) {
      throw new Error('Select at least one person');
    }

    const previewId =
      await this.outreachAiColumnService.createSampleMessagePreview({
        workspaceId,
        projectId,
        include,
      });

    return this.startRun({
      workspaceId,
      projectId,
      tab: 'people',
      previewId,
      rerunAll: true,
      rowIds,
    });
  }

  async startRun({
    workspaceId,
    projectId,
    tab,
    previewId,
    rerunAll,
    onlyViewMatches,
    rowLimit,
    rowIds,
    rowScope,
    threadId,
  }: {
    workspaceId: string;
    projectId: string;
    tab: OutreachTableTab;
    previewId: string;
    rerunAll?: boolean;
    onlyViewMatches?: boolean;
    rowLimit?: number;
    rowIds?: string[];
    rowScope?: AiColumnRowScope;
    threadId?: string;
  }): Promise<RunState> {
    const preview =
      await this.outreachAiColumnService.getPreviewState(previewId);

    if (
      !isDefined(preview) ||
      preview.workspaceId !== workspaceId ||
      preview.projectId !== projectId ||
      preview.tab !== tab
    ) {
      throw new Error(
        'Preview not found or expired. Call preview_ai_column again before running.',
      );
    }

    const activeRunId = await this.cache.get<string>(
      this.activeKey(workspaceId, projectId),
    );
    const activeRun = isDefined(activeRunId)
      ? await this.getRun(activeRunId)
      : undefined;

    if (isDefined(activeRun) && isStalled(activeRun)) {
      await this.finish(
        activeRun,
        'failed',
        'Stalled: the background job stopped (the worker probably restarted). A new run replaced it.',
      );
    } else if (
      isDefined(activeRun) &&
      !CHUNKED_RUN_TERMINAL_STATUSES.includes(activeRun.status)
    ) {
      throw new Error(
        `A column ("${activeRun.filter.name}") is already running for this project (${activeRun.done}/${activeRun.total}). Wait for it to finish or cancel it first.`,
      );
    }

    const rows = await this.outreachTabService.getAll({
      workspaceId,
      projectId,
      tab,
    });
    // Rows outside the applied view stay untouched and unpaid for.
    const view =
      onlyViewMatches === true
        ? await this.outreachTableViewService.get({
            workspaceId,
            projectId,
            tab,
          })
        : null;
    const viewMatched = isDefined(view)
      ? rows.filter((row) =>
          view.filters.every((filter) =>
            matchesTableFilter(readCellText(row, filter.columnId), filter),
          ),
        )
      : rows;
    const scopedRowIds = await this.resolveScopedRowIds({
      threadId,
      projectId,
      tab,
      rowIds,
      rowScope,
    });
    const rowIdSet =
      isDefined(scopedRowIds) && scopedRowIds.length > 0
        ? new Set(scopedRowIds)
        : null;
    const selectionMatched = isDefined(rowIdSet)
      ? viewMatched.filter((row) => rowIdSet.has(row.id))
      : viewMatched;

    if (isDefined(rowIdSet) && selectionMatched.length === 0) {
      throw new Error(
        rowScope === 'chat_upserts'
          ? "No rows from this chat's upserts are on this project tab. Search or upsert first, or use rowScope unfilled."
          : 'None of the selected people are in this project list',
      );
    }

    const columnKeys = preview.filter.fields.map((field) => field.name);
    // "ok" with an empty value means "no credible answer": already answered,
    // so a retry does not pay for it again. Failed rows have no "ok" marker.
    const isFilled = (row: OutreachTabRow): boolean =>
      isAiColumnFilled(row, columnKeys);
    // Skip filled first (unless rerunAll / rowScope all), then apply rowLimit
    // — first N unfilled of the view-/selection-filtered tab.
    const includeFilled = rerunAll === true || rowScope === 'all';
    const candidates = includeFilled
      ? selectionMatched
      : selectionMatched.filter((row) => !isFilled(row));
    const all =
      isDefined(rowLimit) && rowLimit > 0
        ? candidates.slice(0, rowLimit)
        : candidates;
    const filledIds = new Set<string>();
    const precomputedIds = all
      .filter((row) => isDefined(preview.previewedRows[row.id]))
      .map((row) => row.id);
    const precomputed = new Set(precomputedIds);
    const pending = all.filter((row) => !precomputed.has(row.id));
    const units = this.buildUnits(pending, tab, preview.filter);
    const state: RunState = {
      runId: randomUUID(),
      workspaceId,
      projectId,
      tab,
      previewId,
      filter: preview.filter,
      status: 'queued',
      total: all.length,
      done: 0,
      answered: 0,
      failed: 0,
      units,
      unitCursor: 0,
      precomputedIds,
      failures: [],
      usage: null,
      written: { ephemeralUpdated: 0, crmUpdated: 0 },
      cancelRequested: false,
      startedAt: new Date().toISOString(),
    };
    const snapshot: RowSnapshot = {};

    for (const row of all) {
      if (!filledIds.has(row.id)) {
        snapshot[row.id] = { ...row, otherFields: {} };
      }
    }

    await this.cache.set(this.rowsKey(state.runId), snapshot, RUN_TTL_MS);
    await this.cache.set(
      this.activeKey(workspaceId, projectId),
      state.runId,
      RUN_TTL_MS,
    );

    if (units.length === 0 && precomputedIds.length === 0) {
      return this.finish(state, 'completed');
    }

    await this.saveAndEmit(state);
    await this.enqueueChunk(state.runId);

    return state;
  }

  async processChunk(runId: string): Promise<void> {
    const state = await this.getRun(runId);

    if (
      !isDefined(state) ||
      CHUNKED_RUN_TERMINAL_STATUSES.includes(state.status)
    ) {
      return;
    }

    if (state.cancelRequested) {
      await this.finish(state, 'cancelled');

      return;
    }

    const snapshot = await this.cache.get<RowSnapshot>(this.rowsKey(runId));

    if (!isDefined(snapshot)) {
      await this.finish(
        state,
        'failed',
        'Run data expired. Start the column again.',
      );

      return;
    }

    state.status = 'running';

    try {
      await this.processChunkOrThrow(state, snapshot);
    } catch (error) {
      // A failing chunk must end the run visibly, not leave it "running" and
      // block the project; the filled rows are kept.
      await this.finish(
        state,
        'failed',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private async processChunkOrThrow(
    state: RunState,
    snapshot: RowSnapshot,
  ): Promise<void> {
    const runId = state.runId;
    const chunkUnits = state.units.slice(
      state.unitCursor,
      state.unitCursor + UNITS_PER_CHUNK,
    );
    const evaluateRows = chunkUnits
      .flat()
      .map((id) => snapshot[id])
      .filter(isDefined);
    const results: OutreachAiColumnRowResult[] = [];

    if (state.unitCursor === 0) {
      const preview = await this.outreachAiColumnService.getPreviewState(
        state.previewId,
      );

      for (const id of state.precomputedIds) {
        const previewed = preview?.previewedRows[id];

        if (isDefined(previewed)) {
          results.push(previewed);
        }
      }
    }

    if (evaluateRows.length > 0) {
      const evaluated = await this.outreachAiColumnService.evaluateRows(
        evaluateRows,
        state.tab,
        state.filter,
        state.workspaceId,
      );

      results.push(...evaluated.results);
      state.usage = this.mergeUsage(state.usage, evaluated.usage);
    }

    const written = await this.outreachTabService.writeOtherFields({
      workspaceId: state.workspaceId,
      projectId: state.projectId,
      tab: state.tab,
      valuesByRowId: this.buildValues(state, results),
    });

    state.written = {
      ephemeralUpdated:
        state.written.ephemeralUpdated + written.ephemeralUpdated,
      crmUpdated: state.written.crmUpdated + written.crmUpdated,
    };

    const answered = results.filter((result) => result.status === 'answered');
    const failed = results.filter((result) => result.status === 'failed');

    state.done += results.length;
    state.answered += answered.length;
    state.failed += failed.length;
    state.unitCursor += chunkUnits.length;

    for (const result of failed) {
      if (state.failures.length < 10) {
        state.failures.push({
          id: result.id,
          name: result.name,
          error: result.error,
        });
      }
    }

    // Out of credits: every further row would fail the same way.
    if (
      answered.length === 0 &&
      failed.length > 0 &&
      failed.every((result) => isQuotaError(result.error))
    ) {
      await this.finish(state, 'failed', failed[0].error);

      return;
    }

    this.outreachCacheRealtimeService.notifyProjectCacheUpdated(
      state.projectId,
      'journey',
    );

    if (state.unitCursor >= state.units.length) {
      await this.finish(state, 'completed');

      return;
    }

    await this.saveAndEmit(state);
    await this.enqueueChunk(runId);
  }

  async getRun(runId: string): Promise<RunState | undefined> {
    return this.cache.get<RunState>(this.runKey(runId));
  }

  async cancelRun(runId: string): Promise<RunState | undefined> {
    const state = await this.getRun(runId);

    if (
      !isDefined(state) ||
      CHUNKED_RUN_TERMINAL_STATUSES.includes(state.status)
    ) {
      return state;
    }

    // Always finish now: a stalled worker never reads cancelRequested, and the
    // UI Stop button is meant to unblock the project immediately. Rows already
    // written by earlier chunks stay.
    return this.finish(state, 'cancelled');
  }

  async cancelActiveRunForProject({
    workspaceId,
    projectId,
    runId,
  }: {
    workspaceId: string;
    projectId: string;
    runId?: string;
  }): Promise<RunState | undefined> {
    const activeRunId =
      runId ??
      (await this.cache.get<string>(this.activeKey(workspaceId, projectId)));

    if (!isDefined(activeRunId)) {
      return undefined;
    }

    return this.cancelRun(activeRunId);
  }

  async waitForRun(runId: string, maxWaitMs: number): Promise<RunState> {
    const state = await waitForChunkedRun(() => this.getRun(runId), maxWaitMs);

    if (!isDefined(state)) {
      throw new Error('Run not found or expired.');
    }

    return state;
  }

  summarize(state: RunState) {
    return {
      runId: state.runId,
      status: state.status,
      stalled: isStalled(state),
      label: state.filter.name,
      total: state.total,
      done: state.done,
      answered: state.answered,
      failed: state.failed,
      columnKeys: state.filter.fields.map((field) => field.name),
      written: state.written,
      usage: state.usage,
      failures: state.failures,
      ...(isDefined(state.error) ? { error: state.error } : {}),
    };
  }

  private buildUnits(
    pending: OutreachTabRow[],
    tab: OutreachTableTab,
    filter: OutreachAiColumnFilter,
  ): string[][] {
    if (!shouldGroupByCompany(tab, filter)) {
      return pending.map((row) => [row.id]);
    }

    const byKey = new Map<string, string[]>();

    for (const row of pending) {
      const key = companyGroupKey(row);

      byKey.set(key, [...(byKey.get(key) ?? []), row.id]);
    }

    return [...byKey.values()];
  }

  // Answered rows get the value plus an "ok" marker; failed rows get only a
  // "failed" marker, so the table can tell failed from unknown and a re-run
  // knows which rows to retry.
  private buildValues(
    state: RunState,
    results: OutreachAiColumnRowResult[],
  ): Map<string, Record<string, unknown>> {
    const ranAt = new Date().toISOString();
    const valuesByRowId = new Map<string, Record<string, unknown>>();

    for (const result of results) {
      const answered = result.status === 'answered';
      const aiColumns = Object.fromEntries(
        state.filter.fields.map((field, index) => [
          field.name,
          {
            label: index === 0 ? state.filter.name : humanizeKey(field.name),
            type: field.type,
            ...(field.type === 'enum' ? { enumValues: field.enumValues } : {}),
            model: state.filter.selectedModel,
            ranAt,
            status: answered ? 'ok' : 'failed',
            ...(!answered && isDefined(result.error)
              ? { error: result.error }
              : {}),
          },
        ]),
      );

      valuesByRowId.set(result.id, {
        aiColumns,
        ...(answered ? result.values : {}),
      });
    }

    return valuesByRowId;
  }

  private mergeUsage(
    current: OutreachAiColumnUsage | null,
    next: OutreachAiColumnUsage,
  ): OutreachAiColumnUsage {
    if (!isDefined(current)) {
      return next;
    }

    return {
      ...next,
      calls: current.calls + next.calls,
      webSearchCalls: current.webSearchCalls + next.webSearchCalls,
      inputTokens: current.inputTokens + next.inputTokens,
      outputTokens: current.outputTokens + next.outputTokens,
      durationMs: current.durationMs + next.durationMs,
      estimatedCostUsd:
        current.estimatedCostUsd === null || next.estimatedCostUsd === null
          ? null
          : Number(
              (current.estimatedCostUsd + next.estimatedCostUsd).toFixed(6),
            ),
    };
  }

  private async finish(
    state: RunState,
    status: OutreachAiColumnRunStatus,
    error?: string,
  ): Promise<RunState> {
    state.status = status;
    state.finishedAt = new Date().toISOString();

    if (isDefined(error)) {
      state.error = error;
    }

    const activeKey = this.activeKey(state.workspaceId, state.projectId);

    if ((await this.cache.get<string>(activeKey)) === state.runId) {
      await this.cache.del(activeKey);
    }

    await this.saveAndEmit(state);

    this.outreachCacheRealtimeService.notifyProjectCacheUpdated(
      state.projectId,
      'journey',
    );
    this.logger.log(
      `AI column run ${state.runId} ${status} answered=${state.answered} failed=${state.failed} total=${state.total}`,
    );
    await this.recordFitmentRun(state);

    return state;
  }

  // A fitment run is a step of the sourcing funnel: record how it came out
  private async recordFitmentRun(state: RunState): Promise<void> {
    const fitment = state.filter.fitment;

    if (!isDefined(fitment) || !isDefined(this.sourcingLedgerService)) {
      return;
    }

    try {
      const rows = await this.outreachTabService.getAll({
        workspaceId: state.workspaceId,
        projectId: state.projectId,
        tab: state.tab,
      });
      const { outcomes } = computeSourcingFunnel(rows);

      await this.sourcingLedgerService.append(
        state.workspaceId,
        state.projectId,
        {
          kind: 'score',
          at: new Date().toISOString(),
          stage: fitment.stage,
          column: state.filter.name,
          rows: state.total,
          pass: outcomes.pass,
          unknown: outcomes.unknown,
          fail: outcomes.fail,
          failedRows: state.failed,
          threshold: fitment.threshold,
          costUsd: state.usage?.estimatedCostUsd ?? null,
        },
      );
    } catch (error) {
      this.logger.warn(
        `Could not record the fitment run in the sourcing ledger: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async saveAndEmit(state: RunState): Promise<void> {
    state.updatedAt = new Date().toISOString();
    await this.cache.set(this.runKey(state.runId), state, RUN_TTL_MS);
    this.outreachCacheRealtimeService.notifyAiColumnProgress(state.projectId, {
      runId: state.runId,
      label: state.filter.name,
      tab: state.tab,
      status: state.status,
      total: state.total,
      done: state.done,
      failed: state.failed,
      ...(isDefined(state.error) ? { error: state.error } : {}),
    });
  }

  private async enqueueChunk(runId: string): Promise<void> {
    await this.messageQueueService.add<OutreachAiColumnChunkJobData>(
      OUTREACH_AI_COLUMN_CHUNK_JOB_NAME,
      { runId },
      { retryLimit: 1 },
    );
  }

  private runKey(runId: string): string {
    return `outreach-ai-column-run:${runId}`;
  }

  private rowsKey(runId: string): string {
    return `outreach-ai-column-run-rows:${runId}`;
  }

  private activeKey(workspaceId: string, projectId: string): string {
    return `outreach-ai-column-active:${workspaceId}:${projectId}`;
  }

  private async resolveScopedRowIds({
    threadId,
    projectId,
    tab,
    rowIds,
    rowScope,
  }: {
    threadId?: string;
    projectId: string;
    tab: OutreachTableTab;
    rowIds?: string[];
    rowScope?: AiColumnRowScope;
  }): Promise<string[] | undefined> {
    if (isDefined(rowIds) && rowIds.length > 0) {
      return rowIds;
    }

    if (rowScope !== 'chat_upserts') {
      return undefined;
    }

    if (!isDefined(this.chatTabWritesService)) {
      throw new Error(
        'rowScope chat_upserts is unavailable. Pass rowIds from the upsert result, or use rowScope unfilled.',
      );
    }

    const cached = await this.chatTabWritesService.read(
      threadId,
      projectId,
      tab,
    );

    if (cached.length === 0) {
      throw new Error(
        'No upserted rows remembered for this chat on this tab. Search or upsert first, pass writtenRowIds as rowIds, or use rowScope unfilled.',
      );
    }

    return cached;
  }
}
