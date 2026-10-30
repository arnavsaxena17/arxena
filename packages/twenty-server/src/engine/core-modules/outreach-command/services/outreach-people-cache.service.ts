import { Injectable } from '@nestjs/common';

import { OUTREACH_TAB_MAX_ROWS } from 'src/engine/core-modules/outreach-command/constants/outreach-tab.constants';
import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { OUTREACH_PROJECT_CACHE_TTL_MS } from 'src/engine/core-modules/outreach-command/constants/outreach-project-cache.constants';
import { OutreachCacheRealtimeService } from 'src/engine/core-modules/outreach-command/services/outreach-cache-realtime.service';
import { OutreachProjectCacheBackupService } from 'src/engine/core-modules/outreach-command/services/outreach-project-cache-backup.service';

const MAX_PEOPLE_PER_PROJECT = OUTREACH_TAB_MAX_ROWS;

export type OutreachEphemeralPerson = {
  id: string;
  name: string;
  title: string;
  headline?: string;
  summary?: string;
  companyId: string;
  companyName: string;
  linkedinUrl: string;
  warmPath: string;
  stage: string;
  email: string;
  connectionDegree?: number;
  personaPriorityScore?: number;
  otherFields?: Record<string, unknown>;
};

export type OutreachPeopleCachePayload = {
  people: OutreachEphemeralPerson[];
  projectId: string;
  cachedAt: number;
};

const isPlaceholderProjectId = (projectId: string): boolean =>
  projectId === 'job-id' || projectId === 'project-id';

@Injectable()
export class OutreachPeopleCacheService {
  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineOutreachCommand)
    private readonly cache: CacheStorageService,
    private readonly outreachCacheRealtimeService: OutreachCacheRealtimeService,
    private readonly outreachProjectCacheBackupService: OutreachProjectCacheBackupService,
  ) {}

  cacheKey(workspaceId: string, projectId: string): string {
    return `gtm-people:${workspaceId}:${projectId}`;
  }

  async get(
    workspaceId: string,
    projectId: string,
  ): Promise<OutreachPeopleCachePayload | undefined> {
    if (!workspaceId || !projectId || isPlaceholderProjectId(projectId)) {
      return undefined;
    }

    const cached = await this.cache.get<OutreachPeopleCachePayload>(
      this.cacheKey(workspaceId, projectId),
    );

    if (cached && cached.projectId === projectId) {
      return cached;
    }

    const fromBackup =
      await this.outreachProjectCacheBackupService.read<OutreachPeopleCachePayload>(
        workspaceId,
        'people',
        projectId,
      );

    if (!fromBackup || fromBackup.projectId !== projectId) {
      return undefined;
    }

    // Rehydrate Redis so the next read is hot
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
    people: OutreachEphemeralPerson[],
  ): Promise<void> {
    if (!workspaceId || !projectId || isPlaceholderProjectId(projectId)) {
      return;
    }

    const limitedPeople =
      people.length > MAX_PEOPLE_PER_PROJECT
        ? people.slice(0, MAX_PEOPLE_PER_PROJECT)
        : people;

    const payload: OutreachPeopleCachePayload = {
      people: limitedPeople,
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
      'people',
      projectId,
      payload,
    );

    this.outreachCacheRealtimeService.notifyProjectCacheUpdated(
      projectId,
      'people',
    );
  }

  async delete(workspaceId: string, projectId: string): Promise<void> {
    if (!workspaceId || !projectId) {
      return;
    }

    await this.cache.del(this.cacheKey(workspaceId, projectId));
    await this.outreachProjectCacheBackupService.remove(
      workspaceId,
      'people',
      projectId,
    );
    this.outreachCacheRealtimeService.notifyProjectCacheUpdated(
      projectId,
      'people',
    );
  }
}
