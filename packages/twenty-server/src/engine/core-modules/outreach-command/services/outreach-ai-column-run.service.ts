import { Injectable, Logger } from '@nestjs/common';

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
import { OutreachCacheRealtimeService } from 'src/engine/core-modules/outreach-command/services/outreach-cache-realtime.service';
import {
  type OutreachWorkingSetRow,
  type OutreachWorkingSetSubject,
  OutreachWorkingSetService,
} from 'src/engine/core-modules/outreach-command/services/outreach-working-set.service';

export const OUTREACH_AI_COLUMN_CHUNK_JOB_NAME =
  'ProcessOutreachAiColumnChunkJob';

export type OutreachAiColumnChunkJobData = {
  runId: string;
};

export type OutreachAiColumnRunStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

type RunState = {
  runId: string;
  workspaceId: string;
  projectId: string;
  subject: OutreachWorkingSetSubject;
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

type RowSnapshot = Record<string, OutreachWorkingSetRow>;

// CacheStorageService takes milliseconds.
const RUN_TTL_MS = 24 * 60 * 60 * 1000;
// Rows evaluated per queue job. Small enough that other AI filtering jobs on
// the same queue are never blocked for long, large enough to batch writes.
const UNITS_PER_CHUNK = 20;
const WAIT_POLL_MS = 1000;
// A chunk takes seconds. No progress for this long means the job was lost
// (for example the worker restarted), so the run must not block the project.
const STALL_AFTER_MS = 2 * 60 * 1000;
const TERMINAL_STATUSES: OutreachAiColumnRunStatus[] = [
  'completed',
  'failed',
  'cancelled',
];

const isStalled = (state: RunState): boolean =>
  !TERMINAL_STATUSES.includes(state.status) &&
  Date.now() - Date.parse(state.updatedAt ?? state.startedAt) > STALL_AFTER_MS;

const isQuotaError = (message: string | undefined): boolean =>
  /credit_balance_exhausted|insufficient_quota|credits are exhausted/i.test(
    message ?? '',
  );

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

@Injectable()
export class OutreachAiColumnRunService {
  private readonly logger = new Logger(OutreachAiColumnRunService.name);

  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineOutreachCommand)
    private readonly cache: CacheStorageService,
    @InjectMessageQueue(MessageQueue.aiFilteringQueue)
    private readonly messageQueueService: MessageQueueService,
    private readonly outreachAiColumnService: OutreachAiColumnService,
    private readonly outreachWorkingSetService: OutreachWorkingSetService,
    private readonly outreachCacheRealtimeService: OutreachCacheRealtimeService,
  ) {}

  async startRun({
    workspaceId,
    projectId,
    subject,
    previewId,
    rerunAll,
  }: {
    workspaceId: string;
    projectId: string;
    subject: OutreachWorkingSetSubject;
    previewId: string;
    rerunAll?: boolean;
  }): Promise<RunState> {
    const preview = await this.outreachAiColumnService.getPreviewState(previewId);

    if (
      !isDefined(preview) ||
      preview.workspaceId !== workspaceId ||
      preview.projectId !== projectId ||
      preview.subject !== subject
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
      !TERMINAL_STATUSES.includes(activeRun.status)
    ) {
      throw new Error(
        `A column ("${activeRun.filter.name}") is already running for this project (${activeRun.done}/${activeRun.total}). Wait for it to finish or cancel it first.`,
      );
    }

    const all = await this.outreachWorkingSetService.getAll({
      workspaceId,
      projectId,
      subject,
    });
    const columnKeys = preview.filter.fields.map((field) => field.name);
    // Rows that already hold every key are skipped, so a re-run only pays
    // for rows that failed or were added since.
    const aiColumnStatus = (
      row: OutreachWorkingSetRow,
      key: string,
    ): unknown => {
      const meta = row.otherFields.aiColumns;
      const entry =
        typeof meta === 'object' && meta !== null
          ? (meta as Record<string, unknown>)[key]
          : undefined;

      return typeof entry === 'object' && entry !== null
        ? (entry as Record<string, unknown>).status
        : undefined;
    };
    // "ok" with an empty value means "no credible answer": already answered,
    // so a retry does not pay for it again. Failed rows have no "ok" marker.
    const isFilled = (row: OutreachWorkingSetRow): boolean =>
      columnKeys.every(
        (key) =>
          aiColumnStatus(row, key) === 'ok' ||
          (row.otherFields[key] !== undefined && row.otherFields[key] !== null),
      );
    const filledIds = new Set(
      rerunAll === true ? [] : all.filter(isFilled).map((row) => row.id),
    );
    const precomputedIds = all
      .filter((row) => isDefined(preview.previewedRows[row.id]))
      .filter((row) => !filledIds.has(row.id))
      .map((row) => row.id);
    const precomputed = new Set(precomputedIds);
    const pending = all.filter(
      (row) => !precomputed.has(row.id) && !filledIds.has(row.id),
    );
    const units = this.buildUnits(pending, subject, preview.filter);
    const state: RunState = {
      runId: randomUUID(),
      workspaceId,
      projectId,
      subject,
      previewId,
      filter: preview.filter,
      status: 'queued',
      total: all.length,
      done: filledIds.size,
      answered: filledIds.size,
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
    await this.cache.set(this.activeKey(workspaceId, projectId), state.runId, RUN_TTL_MS);

    if (units.length === 0 && precomputedIds.length === 0) {
      return this.finish(state, 'completed');
    }

    await this.saveAndEmit(state);
    await this.enqueueChunk(state.runId);

    return state;
  }

  async processChunk(runId: string): Promise<void> {
    const state = await this.getRun(runId);

    if (!isDefined(state) || TERMINAL_STATUSES.includes(state.status)) {
      return;
    }

    if (state.cancelRequested) {
      await this.finish(state, 'cancelled');

      return;
    }

    const snapshot = await this.cache.get<RowSnapshot>(this.rowsKey(runId));

    if (!isDefined(snapshot)) {
      await this.finish(state, 'failed', 'Run data expired. Start the column again.');

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
        state.subject,
        state.filter,
        state.workspaceId,
      );

      results.push(...evaluated.results);
      state.usage = this.mergeUsage(state.usage, evaluated.usage);
    }

    const written = await this.outreachWorkingSetService.writeOtherFields({
      workspaceId: state.workspaceId,
      projectId: state.projectId,
      subject: state.subject,
      valuesByRowId: this.buildValues(state, results),
    });

    state.written = {
      ephemeralUpdated: state.written.ephemeralUpdated + written.ephemeralUpdated,
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

    if (!isDefined(state) || TERMINAL_STATUSES.includes(state.status)) {
      return state;
    }

    state.cancelRequested = true;

    if (state.status === 'queued' || isStalled(state)) {
      return this.finish(state, 'cancelled');
    }

    state.updatedAt = new Date().toISOString();
    await this.cache.set(this.runKey(runId), state, RUN_TTL_MS);

    return state;
  }

  async waitForRun(runId: string, maxWaitMs: number): Promise<RunState> {
    const deadline = Date.now() + maxWaitMs;
    let state = await this.getRun(runId);

    while (
      isDefined(state) &&
      !TERMINAL_STATUSES.includes(state.status) &&
      Date.now() < deadline
    ) {
      await sleep(WAIT_POLL_MS);
      state = await this.getRun(runId);
    }

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
    pending: OutreachWorkingSetRow[],
    subject: OutreachWorkingSetSubject,
    filter: OutreachAiColumnFilter,
  ): string[][] {
    if (!shouldGroupByCompany(subject, filter)) {
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
          : Number((current.estimatedCostUsd + next.estimatedCostUsd).toFixed(6)),
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

    return state;
  }

  private async saveAndEmit(state: RunState): Promise<void> {
    state.updatedAt = new Date().toISOString();
    await this.cache.set(this.runKey(state.runId), state, RUN_TTL_MS);
    this.outreachCacheRealtimeService.notifyAiColumnProgress(state.projectId, {
      runId: state.runId,
      label: state.filter.name,
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
}
