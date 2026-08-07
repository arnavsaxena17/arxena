import { Injectable } from '@nestjs/common';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';

const GTM_COMPANIES_CACHE_TTL_SECONDS = 3 * 30 * 24 * 60 * 60; // 3 months
const MAX_COMPANIES_PER_PROJECT = 500;

export type GtmEphemeralCompany = {
  id: string;
  name: string;
  domain: string;
  industry: string;
  employees: string;
  segment: string;
  icpFit: string;
  status: string;
};

export type GtmCompaniesCachePayload = {
  companies: GtmEphemeralCompany[];
  projectId: string;
  cachedAt: number;
};

const isPlaceholderProjectId = (projectId: string): boolean =>
  projectId === 'job-id' || projectId === 'project-id';

@Injectable()
export class GtmCompaniesCacheService {
  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineGtmCommand)
    private readonly cache: CacheStorageService,
  ) {}

  cacheKey(workspaceId: string, projectId: string): string {
    return `gtm-companies:${workspaceId}:${projectId}`;
  }

  async get(
    workspaceId: string,
    projectId: string,
  ): Promise<GtmCompaniesCachePayload | undefined> {
    if (!workspaceId || !projectId || isPlaceholderProjectId(projectId)) {
      return undefined;
    }

    const payload = await this.cache.get<GtmCompaniesCachePayload>(
      this.cacheKey(workspaceId, projectId),
    );

    if (!payload || payload.projectId !== projectId) {
      return undefined;
    }

    return payload;
  }

  async set(
    workspaceId: string,
    projectId: string,
    companies: GtmEphemeralCompany[],
  ): Promise<void> {
    if (!workspaceId || !projectId || isPlaceholderProjectId(projectId)) {
      return;
    }

    const limitedCompanies =
      companies.length > MAX_COMPANIES_PER_PROJECT
        ? companies.slice(0, MAX_COMPANIES_PER_PROJECT)
        : companies;

    const payload: GtmCompaniesCachePayload = {
      companies: limitedCompanies,
      projectId,
      cachedAt: Date.now(),
    };

    await this.cache.set(
      this.cacheKey(workspaceId, projectId),
      payload,
      GTM_COMPANIES_CACHE_TTL_SECONDS,
    );
  }

  async delete(workspaceId: string, projectId: string): Promise<void> {
    if (!workspaceId || !projectId) {
      return;
    }

    await this.cache.del(this.cacheKey(workspaceId, projectId));
  }
}
