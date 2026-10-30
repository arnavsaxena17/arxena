import { Injectable } from '@nestjs/common';

import { OUTREACH_TAB_MAX_ROWS } from 'src/engine/core-modules/outreach-command/constants/outreach-tab.constants';
import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { OUTREACH_PROJECT_CACHE_TTL_MS } from 'src/engine/core-modules/outreach-command/constants/outreach-project-cache.constants';
import { OutreachCacheRealtimeService } from 'src/engine/core-modules/outreach-command/services/outreach-cache-realtime.service';
import { OutreachProjectCacheBackupService } from 'src/engine/core-modules/outreach-command/services/outreach-project-cache-backup.service';

const MAX_COMPANIES_PER_PROJECT = OUTREACH_TAB_MAX_ROWS;

export type OutreachEphemeralCompany = {
  id: string;
  name: string;
  domain: string;
  industry: string;
  employees: string;
  segment: string;
  icpFit: string;
  status: string;
  // AI filter / enrichment columns: one key per column.
  otherFields?: Record<string, unknown>;
};

export type OutreachCompaniesCachePayload = {
  companies: OutreachEphemeralCompany[];
  projectId: string;
  cachedAt: number;
};

const isPlaceholderProjectId = (projectId: string): boolean =>
  projectId === 'job-id' || projectId === 'project-id';

@Injectable()
export class OutreachCompaniesCacheService {
  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineOutreachCommand)
    private readonly cache: CacheStorageService,
    private readonly outreachCacheRealtimeService: OutreachCacheRealtimeService,
    private readonly outreachProjectCacheBackupService: OutreachProjectCacheBackupService,
  ) {}

  cacheKey(workspaceId: string, projectId: string): string {
    return `gtm-companies:${workspaceId}:${projectId}`;
  }

  async get(
    workspaceId: string,
    projectId: string,
  ): Promise<OutreachCompaniesCachePayload | undefined> {
    if (!workspaceId || !projectId || isPlaceholderProjectId(projectId)) {
      return undefined;
    }

    const cached = await this.cache.get<OutreachCompaniesCachePayload>(
      this.cacheKey(workspaceId, projectId),
    );

    if (cached && cached.projectId === projectId) {
      return cached;
    }

    const fromBackup =
      await this.outreachProjectCacheBackupService.read<OutreachCompaniesCachePayload>(
        workspaceId,
        'companies',
        projectId,
      );

    if (!fromBackup || fromBackup.projectId !== projectId) {
      return undefined;
    }

    await this.cache.set(
      this.cacheKey(workspaceId, projectId),
      fromBackup,
      OUTREACH_PROJECT_CACHE_TTL_MS,
    );

    return fromBackup;
  }

  async set(
    workspaceId: string,
    projectId: string,
    companies: OutreachEphemeralCompany[],
  ): Promise<void> {
    if (!workspaceId || !projectId || isPlaceholderProjectId(projectId)) {
      return;
    }

    const limitedCompanies =
      companies.length > MAX_COMPANIES_PER_PROJECT
        ? companies.slice(0, MAX_COMPANIES_PER_PROJECT)
        : companies;

    const payload: OutreachCompaniesCachePayload = {
      companies: limitedCompanies,
      projectId,
      cachedAt: Date.now(),
    };

    await this.cache.set(
      this.cacheKey(workspaceId, projectId),
      payload,
      OUTREACH_PROJECT_CACHE_TTL_MS,
    );
    await this.outreachProjectCacheBackupService.write(
      workspaceId,
      'companies',
      projectId,
      payload,
    );

    this.outreachCacheRealtimeService.notifyProjectCacheUpdated(
      projectId,
      'companies',
    );
  }

  async delete(workspaceId: string, projectId: string): Promise<void> {
    if (!workspaceId || !projectId) {
      return;
    }

    await this.cache.del(this.cacheKey(workspaceId, projectId));
    await this.outreachProjectCacheBackupService.remove(
      workspaceId,
      'companies',
      projectId,
    );
    this.outreachCacheRealtimeService.notifyProjectCacheUpdated(
      projectId,
      'companies',
    );
  }
}
