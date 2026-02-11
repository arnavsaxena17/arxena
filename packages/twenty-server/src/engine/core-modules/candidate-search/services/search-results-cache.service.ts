import { Injectable } from '@nestjs/common';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';

const SEARCH_RESULTS_CACHE_TTL_SECONDS = 3 * 30 * 24 * 60 * 60; // 3 months
const MAX_CANDIDATES_PER_JOB = 500;

export type SearchResultsCachePayload = {
  results: any[];
  metadata: {
    totalCount: number;
    currentPage: number;
    totalPages: number;
    cursor?: string;
    searchType?: string;
    searchCategory?: string;
    searchParameters?: any;
  };
  jobId: string;
  cachedAt: number;
};

@Injectable()
export class SearchResultsCacheService {
  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineCandidateSearch)
    private readonly cache: CacheStorageService,
  ) {}

  cacheKey(workspaceId: string, jobId: string): string {
    return `${workspaceId}:${jobId}`;
  }

  async get(
    workspaceId: string,
    jobId: string,
  ): Promise<SearchResultsCachePayload | undefined> {
    if (!workspaceId || !jobId || jobId === 'job-id') {
      return undefined;
    }
    const key = this.cacheKey(workspaceId, jobId);
    const payload = await this.cache.get<SearchResultsCachePayload>(key);
    if (!payload || payload.jobId !== jobId) {
      return undefined;
    }
    return payload;
  }

  async set(
    workspaceId: string,
    jobId: string,
    results: any[],
    metadata: SearchResultsCachePayload['metadata'],
  ): Promise<void> {
    if (!workspaceId || !jobId || jobId === 'job-id') {
      return;
    }
    const limitedResults =
      results.length > MAX_CANDIDATES_PER_JOB
        ? results.slice(0, MAX_CANDIDATES_PER_JOB)
        : results;
    const payload: SearchResultsCachePayload = {
      results: limitedResults,
      metadata,
      jobId,
      cachedAt: Date.now(),
    };
    const key = this.cacheKey(workspaceId, jobId);
    await this.cache.set(key, payload, SEARCH_RESULTS_CACHE_TTL_SECONDS);
  }

  async delete(workspaceId: string, jobId: string): Promise<void> {
    if (!workspaceId || !jobId) return;
    await this.cache.del(this.cacheKey(workspaceId, jobId));
  }
}
