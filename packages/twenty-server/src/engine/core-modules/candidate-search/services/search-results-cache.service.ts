import { Injectable } from '@nestjs/common';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';

const SEARCH_RESULTS_CACHE_TTL_SECONDS = 3 * 30 * 24 * 60 * 60; // 3 months
const MAX_CANDIDATES_PER_PROJECT = 500;

const isPlaceholderProjectId = (projectId: string): boolean =>
  projectId === 'job-id' || projectId === 'project-id';

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
  projectId: string;
  cachedAt: number;
};

// Pre-rename Redis payloads stored `jobId` instead of `projectId`
type LegacySearchResultsCachePayload = Omit<
  SearchResultsCachePayload,
  'projectId'
> & {
  projectId?: string;
  jobId?: string;
};

@Injectable()
export class SearchResultsCacheService {
  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineCandidateSearch)
    private readonly cache: CacheStorageService,
  ) {}

  cacheKey(workspaceId: string, projectId: string): string {
    return `${workspaceId}:${projectId}`;
  }

  async get(
    workspaceId: string,
    projectId: string,
  ): Promise<SearchResultsCachePayload | undefined> {
    if (!workspaceId || !projectId || isPlaceholderProjectId(projectId)) {
      return undefined;
    }
    const key = this.cacheKey(workspaceId, projectId);
    const payload =
      await this.cache.get<LegacySearchResultsCachePayload>(key);
    if (!payload) {
      return undefined;
    }
    // Accept legacy `jobId` so Job→Project rename does not orphan Redis entries
    const cachedProjectId = payload.projectId ?? payload.jobId;
    if (cachedProjectId !== projectId) {
      return undefined;
    }
    return {
      results: payload.results,
      metadata: payload.metadata,
      projectId: cachedProjectId,
      cachedAt: payload.cachedAt,
    };
  }

  async set(
    workspaceId: string,
    projectId: string,
    results: any[],
    metadata: SearchResultsCachePayload['metadata'],
  ): Promise<void> {
    if (!workspaceId || !projectId || isPlaceholderProjectId(projectId)) {
      return;
    }
    const limitedResults =
      results.length > MAX_CANDIDATES_PER_PROJECT
        ? results.slice(0, MAX_CANDIDATES_PER_PROJECT)
        : results;
    const payload: SearchResultsCachePayload = {
      results: limitedResults,
      metadata,
      projectId,
      cachedAt: Date.now(),
    };
    const key = this.cacheKey(workspaceId, projectId);
    await this.cache.set(key, payload, SEARCH_RESULTS_CACHE_TTL_SECONDS);
  }

  async delete(workspaceId: string, projectId: string): Promise<void> {
    if (!workspaceId || !projectId) return;
    await this.cache.del(this.cacheKey(workspaceId, projectId));
  }
}
