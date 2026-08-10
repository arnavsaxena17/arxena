import { Injectable } from '@nestjs/common';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';

const GTM_PEOPLE_CACHE_TTL_SECONDS = 3 * 30 * 24 * 60 * 60; // 3 months
const MAX_PEOPLE_PER_PROJECT = 500;

export type GtmEphemeralPerson = {
  id: string;
  name: string;
  title: string;
  companyId: string;
  companyName: string;
  linkedinUrl: string;
  warmPath: string;
  stage: string;
  email: string;
  connectionDegree?: number;
  personaPriorityScore?: number;
};

export type GtmPeopleCachePayload = {
  people: GtmEphemeralPerson[];
  projectId: string;
  cachedAt: number;
};

const isPlaceholderProjectId = (projectId: string): boolean =>
  projectId === 'job-id' || projectId === 'project-id';

@Injectable()
export class GtmPeopleCacheService {
  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineGtmCommand)
    private readonly cache: CacheStorageService,
  ) {}

  cacheKey(workspaceId: string, projectId: string): string {
    return `gtm-people:${workspaceId}:${projectId}`;
  }

  async get(
    workspaceId: string,
    projectId: string,
  ): Promise<GtmPeopleCachePayload | undefined> {
    if (!workspaceId || !projectId || isPlaceholderProjectId(projectId)) {
      return undefined;
    }

    const payload = await this.cache.get<GtmPeopleCachePayload>(
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
    people: GtmEphemeralPerson[],
  ): Promise<void> {
    if (!workspaceId || !projectId || isPlaceholderProjectId(projectId)) {
      return;
    }

    const limitedPeople =
      people.length > MAX_PEOPLE_PER_PROJECT
        ? people.slice(0, MAX_PEOPLE_PER_PROJECT)
        : people;

    const payload: GtmPeopleCachePayload = {
      people: limitedPeople,
      projectId,
      cachedAt: Date.now(),
    };

    await this.cache.set(
      this.cacheKey(workspaceId, projectId),
      payload,
      GTM_PEOPLE_CACHE_TTL_SECONDS,
    );
  }

  async delete(workspaceId: string, projectId: string): Promise<void> {
    if (!workspaceId || !projectId) {
      return;
    }

    await this.cache.del(this.cacheKey(workspaceId, projectId));
  }
}
