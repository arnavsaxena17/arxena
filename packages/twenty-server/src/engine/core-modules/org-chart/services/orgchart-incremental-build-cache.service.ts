import { Injectable } from '@nestjs/common';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';

import { toOrgChartCacheTtlMs } from '../utils/org-chart-cache-ttl.util';

type OrgChartIncrementalBuildCache = {
  companyName: string;
  companyId?: string;
  candidateSources: string[];
  startedAt: string;
  updatedAt: string;
  items: Array<Record<string, unknown>>;
  dedupedItemCount: number;
  lastPartialOrgChartBuiltAt?: string;
};

const INCREMENTAL_ORGCHART_CACHE_TTL_SECONDS = 60 * 60; // 1 hour

@Injectable()
export class OrgChartIncrementalBuildCacheService {
  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineOrgChart)
    private readonly cacheStorage: CacheStorageService,
  ) {}

  private buildKey(requestId: string): string {
    return `incremental-orgchart:${requestId}`;
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
    await this.cacheStorage.set(
      this.buildKey(requestId.trim()),
      value,
      toOrgChartCacheTtlMs(INCREMENTAL_ORGCHART_CACHE_TTL_SECONDS),
    );
  }

  async del(requestId: string): Promise<void> {
    if (!requestId?.trim()) return;
    await this.cacheStorage.del(this.buildKey(requestId.trim()));
  }
}

