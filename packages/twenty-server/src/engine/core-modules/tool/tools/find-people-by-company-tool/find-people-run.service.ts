import { Injectable } from '@nestjs/common';

import { randomUUID } from 'crypto';

import { isDefined } from 'twenty-shared/utils';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import {
  type ChunkedRunStatus,
  isChunkedRunStalled,
  isChunkedRunTerminal,
  waitForChunkedRun,
} from 'src/engine/core-modules/outreach-command/utils/chunked-run.util';
import { type FindPeopleTerminalState } from 'src/engine/core-modules/outreach-command/utils/outreach-people-found.util';
import {
  type FindPeopleByCompanyTarget,
  type ResolvedInput,
} from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/find-people-by-company.types';

export const FIND_PEOPLE_CHUNK_JOB_NAME = 'ProcessFindPeopleChunkJob';

export type FindPeopleChunkJobData = { runId: string };

// Companies per queue job: one chunk runs in about a minute at the default
// concurrency, so the shared AI filtering queue is never held for long
export const FIND_PEOPLE_COMPANIES_PER_CHUNK = 25;

const RUN_TTL_MS = 24 * 60 * 60 * 1000;

export type FindPeopleRunState = {
  runId: string;
  workspaceId: string;
  projectId: string;
  status: ChunkedRunStatus;
  // Everything the lookup needs except the companies, which are walked by
  // cursor so each chunk knows where to start
  input: Omit<ResolvedInput, 'companies'>;
  companies: FindPeopleByCompanyTarget[];
  cursor: number;
  total: number;
  done: number;
  byState: Partial<Record<FindPeopleTerminalState, number>>;
  spentUsd: number;
  written: number;
  errors: string[];
  halfwayReported: boolean;
  cancelRequested: boolean;
  // Companies left out because the run cap could not cover them. They are not
  // looked up and not failed: a higher cap can pick them up.
  deferredByBudget?: number;
  budgetExhausted?: boolean;
  // The caller's identity, so the background writes run as the same member
  userId?: string;
  userWorkspaceId?: string;
  threadId?: string;
  startedAt: string;
  updatedAt?: string;
  finishedAt?: string;
  error?: string;
};

@Injectable()
export class FindPeopleRunService {
  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineOutreachCommand)
    private readonly cache: CacheStorageService,
    @InjectMessageQueue(MessageQueue.aiFilteringQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {}

  private runKey(runId: string): string {
    return `find-people-run:${runId}`;
  }

  private activeKey(workspaceId: string, projectId: string): string {
    return `find-people-run-active:${workspaceId}:${projectId}`;
  }

  // One run per project: a second one would write the same rows. A stalled
  // run (its worker gone) no longer blocks a new one.
  async start(
    state: Omit<
      FindPeopleRunState,
      | 'runId'
      | 'status'
      | 'cursor'
      | 'done'
      | 'byState'
      | 'spentUsd'
      | 'written'
      | 'errors'
      | 'halfwayReported'
      | 'cancelRequested'
      | 'startedAt'
      | 'total'
    >,
  ): Promise<FindPeopleRunState> {
    const activeRunId = await this.cache.get<string>(
      this.activeKey(state.workspaceId, state.projectId),
    );
    const activeRun = isDefined(activeRunId)
      ? await this.getRun(activeRunId)
      : undefined;

    if (
      isDefined(activeRun) &&
      !isChunkedRunTerminal(activeRun) &&
      !isChunkedRunStalled(activeRun)
    ) {
      throw new Error(
        `A people lookup is already running on this project (runId ${activeRun.runId}); read it with runId, or cancel it first.`,
      );
    }

    const run: FindPeopleRunState = {
      ...state,
      runId: randomUUID(),
      status: 'queued',
      cursor: 0,
      total: state.companies.length,
      done: 0,
      byState: {},
      spentUsd: 0,
      written: 0,
      errors: [],
      halfwayReported: false,
      cancelRequested: false,
      startedAt: new Date().toISOString(),
    };

    await this.save(run);
    await this.cache.set(
      this.activeKey(run.workspaceId, run.projectId),
      run.runId,
      RUN_TTL_MS,
    );
    await this.enqueueChunk(run.runId);

    return run;
  }

  async getRun(runId: string): Promise<FindPeopleRunState | undefined> {
    return (
      (await this.cache.get<FindPeopleRunState>(this.runKey(runId))) ??
      undefined
    );
  }

  async save(state: FindPeopleRunState): Promise<void> {
    await this.cache.set(
      this.runKey(state.runId),
      { ...state, updatedAt: new Date().toISOString() },
      RUN_TTL_MS,
    );
  }

  async enqueueChunk(runId: string): Promise<void> {
    await this.messageQueueService.add<FindPeopleChunkJobData>(
      FIND_PEOPLE_CHUNK_JOB_NAME,
      { runId },
    );
  }

  async finish(
    state: FindPeopleRunState,
    status: ChunkedRunStatus,
    error?: string,
  ): Promise<FindPeopleRunState> {
    const finished: FindPeopleRunState = {
      ...state,
      status,
      finishedAt: new Date().toISOString(),
      ...(isDefined(error) && { error }),
    };

    await this.save(finished);

    return finished;
  }

  // Always finishes now: a stalled worker never reads cancelRequested.
  // Companies already looked up keep their results.
  async cancel(runId: string): Promise<FindPeopleRunState | undefined> {
    const state = await this.getRun(runId);

    if (!isDefined(state) || isChunkedRunTerminal(state)) {
      return state;
    }

    return this.finish({ ...state, cancelRequested: true }, 'cancelled');
  }

  async waitForRun(
    runId: string,
    maxWaitMs: number,
  ): Promise<FindPeopleRunState | undefined> {
    return waitForChunkedRun(() => this.getRun(runId), maxWaitMs);
  }

  summarize(state: FindPeopleRunState) {
    return {
      runId: state.runId,
      status: state.status,
      stalled: isChunkedRunStalled(state),
      total: state.total,
      done: state.done,
      byState: state.byState,
      spentUsd: Number(state.spentUsd.toFixed(4)),
      written: state.written,
      ...(state.deferredByBudget !== undefined &&
        state.deferredByBudget > 0 && {
          deferredByBudget: state.deferredByBudget,
        }),
      ...(state.budgetExhausted === true && { budgetExhausted: true }),
      ...(state.errors.length > 0 && { errors: state.errors.slice(-5) }),
      ...(isDefined(state.error) && { error: state.error }),
    };
  }
}
