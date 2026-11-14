import { Injectable } from '@nestjs/common';

import { randomUUID } from 'crypto';

import { isDefined } from 'twenty-shared/utils';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';

// The budget belongs to one run, not to the life of the project: a new run
// cap gets a new budgetRunId and starts from zero. Kept as long as the ledger
// so an exhaustive run that spans turns can still be explained.
const BUDGET_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type StoredBudgetConfig = {
  runCapUsd: number;
  budgetRunId: string;
};

export type SourcingBudgetStatus = {
  // Absent when the brief carries no run cap: the per-call ceilings still
  // apply, but there is nothing to stop a long run
  runCapUsd?: number;
  budgetRunId?: string;
  spentUsd: number;
  remainingUsd?: number;
  exhausted: boolean;
};

export type SourcingBudgetCheck = {
  allowed: boolean;
  status: SourcingBudgetStatus;
  // Why the call was refused, when it was
  message?: string;
};

@Injectable()
export class SourcingBudgetService {
  // Spend and config are read-modify-write on one key; serialize per project
  // so two paid tools finishing together do not lose a charge
  private readonly queues = new Map<string, Promise<unknown>>();

  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineOutreachCommand)
    private readonly cache: CacheStorageService,
  ) {}

  private configKey(workspaceId: string, projectId: string): string {
    return `sourcing-budget-config:${workspaceId}:${projectId}`;
  }

  private spendKey(
    workspaceId: string,
    projectId: string,
    budgetRunId: string,
  ): string {
    return `sourcing-budget-spend:${workspaceId}:${projectId}:${budgetRunId}`;
  }

  private enqueue<TResult>(
    key: string,
    task: () => Promise<TResult>,
  ): Promise<TResult> {
    const previous = this.queues.get(key) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(task);

    this.queues.set(
      key,
      next.catch(() => undefined),
    );
    void next
      .catch(() => undefined)
      .then(() => {
        if (this.queues.get(key) === next) {
          this.queues.delete(key);
        }
      });

    return next;
  }

  // Written by get_sourcing_ledger when the brief carries a run cap. The same
  // cap keeps its spend; a changed cap starts a new budget window.
  async configure({
    workspaceId,
    projectId,
    runCapUsd,
    budgetRunId,
  }: {
    workspaceId: string;
    projectId: string;
    runCapUsd: number;
    budgetRunId?: string;
  }): Promise<StoredBudgetConfig> {
    const key = this.configKey(workspaceId, projectId);
    const previous = await this.cache.get<StoredBudgetConfig>(key);
    const config: StoredBudgetConfig = {
      runCapUsd,
      budgetRunId: budgetRunId ?? previous?.budgetRunId ?? randomUUID(),
    };

    await this.cache.set(key, config, BUDGET_TTL_MS);

    return config;
  }

  async getStatus(
    workspaceId: string,
    projectId: string,
  ): Promise<SourcingBudgetStatus> {
    const config = await this.cache.get<StoredBudgetConfig>(
      this.configKey(workspaceId, projectId),
    );

    if (!isDefined(config)) {
      return { spentUsd: 0, exhausted: false };
    }

    const spentUsd =
      (await this.cache.get<number>(
        this.spendKey(workspaceId, projectId, config.budgetRunId),
      )) ?? 0;
    const remainingUsd = Math.max(0, config.runCapUsd - spentUsd);

    return {
      runCapUsd: config.runCapUsd,
      budgetRunId: config.budgetRunId,
      spentUsd: Number(spentUsd.toFixed(6)),
      remainingUsd: Number(remainingUsd.toFixed(6)),
      exhausted: remainingUsd <= 0,
    };
  }

  // Never throws: a budget that cannot be written must not fail the paid work
  // that already happened. The next read simply sees the earlier total.
  async recordSpend({
    workspaceId,
    projectId,
    usd,
  }: {
    workspaceId: string;
    projectId: string;
    usd: number;
  }): Promise<SourcingBudgetStatus> {
    if (!Number.isFinite(usd) || usd <= 0) {
      return this.getStatus(workspaceId, projectId);
    }

    const config = await this.cache.get<StoredBudgetConfig>(
      this.configKey(workspaceId, projectId),
    );

    if (!isDefined(config)) {
      return { spentUsd: 0, exhausted: false };
    }

    const key = this.spendKey(workspaceId, projectId, config.budgetRunId);

    await this.enqueue(key, async () => {
      const spentUsd = (await this.cache.get<number>(key)) ?? 0;

      await this.cache.set(
        key,
        Number((spentUsd + usd).toFixed(6)),
        BUDGET_TTL_MS,
      );
    });

    return this.getStatus(workspaceId, projectId);
  }

  // Called before a paid step. Without a run cap this always allows the call;
  // the tool's own per-call ceiling is then the only limit.
  async check({
    workspaceId,
    projectId,
    estimatedUsd,
    tool,
  }: {
    workspaceId: string;
    projectId?: string;
    estimatedUsd: number;
    tool: string;
  }): Promise<SourcingBudgetCheck> {
    if (!isDefined(projectId) || projectId.length === 0) {
      return { allowed: true, status: { spentUsd: 0, exhausted: false } };
    }

    const status = await this.getStatus(workspaceId, projectId);

    if (!isDefined(status.runCapUsd)) {
      return { allowed: true, status };
    }

    if (status.exhausted) {
      return {
        allowed: false,
        status,
        message: `The run budget of $${status.runCapUsd.toFixed(2)} is spent ($${status.spentUsd.toFixed(2)}). Ask the user to raise capsUsd.run before ${tool} spends again.`,
      };
    }

    if (status.spentUsd + estimatedUsd > status.runCapUsd + 0.000001) {
      return {
        allowed: false,
        status,
        message: `The run has $${(status.remainingUsd ?? 0).toFixed(2)} left; ${tool} asks for $${estimatedUsd.toFixed(2)}. Lower the call's maxBudgetUsd or ask the user to raise capsUsd.run.`,
      };
    }

    return { allowed: true, status };
  }
}
