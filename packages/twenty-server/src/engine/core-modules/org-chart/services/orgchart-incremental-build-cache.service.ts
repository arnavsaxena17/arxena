import { Injectable } from '@nestjs/common';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import type { OrgchartUnipileShardPlanLlmOutput } from 'src/engine/core-modules/candidate-search/schemas/orgchart-unipile-shard-plan.schema';
import type { OrgchartUnipileCompiledShard } from 'src/engine/core-modules/candidate-search/utils/compile-orgchart-unipile-shards.util';

import { toOrgChartCacheTtlMs } from '../utils/org-chart-cache-ttl.util';

export type OrgchartUnipileUnlimitedProgress = {
  plan: OrgchartUnipileShardPlanLlmOutput;
  compiledShards: OrgchartUnipileCompiledShard[];
  completedStrategyIds: string[];
  currentStrategyId?: string;
  currentCursor?: string;
  collectedProfileKeys: string[];
  updatedAt: string;
  estimatedTotal?: number;
  profilesCollectedSoFar?: number;
  currentShardKey?: string;
  phase?: 'started' | 'completed';
};

export type OrgchartUnipileUnlimitedProgressPublicStatus = {
  requestId: string;
  status: 'in_progress' | 'not_found';
  updatedAt?: string;
  primaryDimension?: string;
  intentSummary?: string;
  shardKeys: string[];
  shardsCompleted: number;
  shardsTotal: number;
  currentShardKey?: string;
  currentStrategyId?: string;
  phase?: 'started' | 'completed';
  profilesCollectedSoFar: number;
  estimatedTotal?: number;
  remainingProfiles?: number;
  message: string;
};

export type OrgChartIncrementalBuildCache = {
  companyName: string;
  companyId?: string;
  candidateSources: string[];
  startedAt: string;
  updatedAt: string;
  items: Array<Record<string, unknown>>;
  dedupedItemCount: number;
  lastPartialOrgChartBuiltAt?: string;
  /** Unlimited Unipile shard crawl snapshot (same requestId; supports GET/reload). */
  unlimitedUnipile?: OrgchartUnipileUnlimitedProgress;
};

const INCREMENTAL_ORGCHART_CACHE_TTL_SECONDS = 60 * 60; // 1 hour
const UNLIMITED_ORGCHART_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

@Injectable()
export class OrgChartIncrementalBuildCacheService {
  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineOrgChart)
    private readonly cacheStorage: CacheStorageService,
  ) {}

  private buildKey(requestId: string): string {
    return `incremental-orgchart:${requestId}`;
  }

  private ttlSecondsFor(value: OrgChartIncrementalBuildCache): number {
    return value.unlimitedUnipile
      ? UNLIMITED_ORGCHART_CACHE_TTL_SECONDS
      : INCREMENTAL_ORGCHART_CACHE_TTL_SECONDS;
  }

  async get(requestId: string): Promise<OrgChartIncrementalBuildCache | null> {
    if (!requestId?.trim()) return null;
    const cached = await this.cacheStorage.get<OrgChartIncrementalBuildCache>(
      this.buildKey(requestId.trim()),
    );
    return cached ?? null;
  }

  async set(
    requestId: string,
    value: OrgChartIncrementalBuildCache,
  ): Promise<void> {
    if (!requestId?.trim()) return;
    // Preserve unlimited shard snapshot unless the caller sets/clears it explicitly
    const existing = await this.get(requestId);
    const next: OrgChartIncrementalBuildCache = {
      ...value,
      unlimitedUnipile: Object.prototype.hasOwnProperty.call(
        value,
        'unlimitedUnipile',
      )
        ? value.unlimitedUnipile
        : existing?.unlimitedUnipile,
    };
    await this.cacheStorage.set(
      this.buildKey(requestId.trim()),
      next,
      toOrgChartCacheTtlMs(this.ttlSecondsFor(next)),
    );
  }

  async del(requestId: string): Promise<void> {
    if (!requestId?.trim()) return;
    await this.cacheStorage.del(this.buildKey(requestId.trim()));
  }

  async getUnlimitedUnipile(
    requestId: string,
  ): Promise<OrgchartUnipileUnlimitedProgress | null> {
    const cached = await this.get(requestId);
    return cached?.unlimitedUnipile ?? null;
  }

  async setUnlimitedUnipile(
    requestId: string,
    unlimitedUnipile: OrgchartUnipileUnlimitedProgress,
    meta?: { companyName?: string; companyId?: string },
  ): Promise<void> {
    const existing = await this.get(requestId);
    const now = new Date().toISOString();

    await this.set(requestId, {
      companyName: existing?.companyName || meta?.companyName || '',
      companyId: existing?.companyId ?? meta?.companyId,
      candidateSources: existing?.candidateSources ?? ['unipile'],
      startedAt: existing?.startedAt ?? now,
      updatedAt: now,
      items: existing?.items ?? [],
      dedupedItemCount: existing?.dedupedItemCount ?? 0,
      lastPartialOrgChartBuiltAt: existing?.lastPartialOrgChartBuiltAt,
      unlimitedUnipile,
    });
  }

  async clearUnlimitedUnipile(requestId: string): Promise<void> {
    const existing = await this.get(requestId);
    if (!existing?.unlimitedUnipile) {
      return;
    }

    await this.set(requestId, {
      ...existing,
      unlimitedUnipile: undefined,
      updatedAt: new Date().toISOString(),
    });
  }

  toUnlimitedPublicStatus(
    requestId: string,
    progress: OrgchartUnipileUnlimitedProgress | null,
  ): OrgchartUnipileUnlimitedProgressPublicStatus {
    const trimmed = requestId.trim();

    if (!progress) {
      return {
        requestId: trimmed,
        status: 'not_found',
        shardKeys: [],
        shardsCompleted: 0,
        shardsTotal: 0,
        profilesCollectedSoFar: 0,
        message: 'No in-progress unlimited Unipile fetch for this requestId.',
      };
    }

    const shardKeys = progress.compiledShards.map((shard) => shard.key);
    const shardsTotal = progress.compiledShards.length;
    const shardsCompleted = progress.completedStrategyIds.length;
    const profilesCollectedSoFar = progress.profilesCollectedSoFar ?? 0;
    const estimatedTotal = progress.estimatedTotal;
    const remainingProfiles =
      typeof estimatedTotal === 'number'
        ? Math.max(0, estimatedTotal - profilesCollectedSoFar)
        : undefined;
    const currentShardKey =
      progress.currentShardKey ??
      (progress.currentStrategyId?.includes('__')
        ? progress.currentStrategyId.slice(
            progress.currentStrategyId.lastIndexOf('__') + 2,
          )
        : progress.currentStrategyId);

    const message =
      progress.phase === 'started' && currentShardKey
        ? `Fetching shard ${Math.min(shardsCompleted + 1, shardsTotal)}/${shardsTotal} (${currentShardKey})… ~${profilesCollectedSoFar.toLocaleString()} collected${
            remainingProfiles !== undefined
              ? `, ~${remainingProfiles.toLocaleString()} remaining`
              : ''
          }.`
        : `Shard ${shardsCompleted}/${shardsTotal} done. ~${profilesCollectedSoFar.toLocaleString()} profiles so far${
            remainingProfiles !== undefined
              ? `, ~${remainingProfiles.toLocaleString()} remaining`
              : ''
          }.`;

    return {
      requestId: trimmed,
      status: 'in_progress',
      updatedAt: progress.updatedAt,
      primaryDimension: progress.plan.primaryDimension,
      intentSummary: progress.plan.intentSummary,
      shardKeys,
      shardsCompleted,
      shardsTotal,
      currentShardKey,
      currentStrategyId: progress.currentStrategyId,
      phase: progress.phase,
      profilesCollectedSoFar,
      estimatedTotal,
      remainingProfiles,
      message,
    };
  }

  async getUnlimitedPublicStatus(
    requestId: string,
  ): Promise<OrgchartUnipileUnlimitedProgressPublicStatus> {
    const progress = await this.getUnlimitedUnipile(requestId);

    return this.toUnlimitedPublicStatus(requestId, progress);
  }
}
