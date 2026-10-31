import { Injectable } from '@nestjs/common';

import { OUTREACH_TAB_MAX_ROWS } from 'src/engine/core-modules/outreach-command/constants/outreach-tab.constants';
import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { OUTREACH_PROJECT_CACHE_TTL_MS } from 'src/engine/core-modules/outreach-command/constants/outreach-project-cache.constants';
import { OutreachCacheRealtimeService } from 'src/engine/core-modules/outreach-command/services/outreach-cache-realtime.service';
import { OutreachProjectCacheBackupService } from 'src/engine/core-modules/outreach-command/services/outreach-project-cache-backup.service';
import { type OutreachCachePersonRow } from 'src/engine/core-modules/outreach-command/utils/outreach-cache-realtime.constants';
import { compactPeople } from 'src/engine/core-modules/outreach-command/utils/merge-people.util';

const MAX_PEOPLE_PER_PROJECT = OUTREACH_TAB_MAX_ROWS;

// The row shape is the wire shape: the realtime payload names the same type so
// a client can apply a written row without importing server code.
export type OutreachEphemeralPerson = OutreachCachePersonRow;

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

  // `writtenRows` names the rows this call added or updated, so listening
  // clients can upsert just those. A write that cannot name its rows (a
  // replace, the client's own PUT, an AI column run) leaves it out and clients
  // refetch instead, which also covers rows that were removed.
  async set(
    workspaceId: string,
    projectId: string,
    people: OutreachEphemeralPerson[],
    options?: { writtenRows?: OutreachEphemeralPerson[] },
  ): Promise<void> {
    if (!workspaceId || !projectId || isPlaceholderProjectId(projectId)) {
      return;
    }

    // The cache is the single write boundary for the People tab: every writer
    // (tools, spreadsheet import, the client PUT) passes through here, so a
    // duplicate must not survive it whatever the caller sent.
    const dedupedPeople = compactPeople(people);
    const limitedPeople =
      dedupedPeople.length > MAX_PEOPLE_PER_PROJECT
        ? dedupedPeople.slice(0, MAX_PEOPLE_PER_PROJECT)
        : dedupedPeople;

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

    // A row cut by the row cap is not in the cache, so it must not be sent as
    // if it were
    const keptIds = new Set(limitedPeople.map((person) => person.id));
    const writtenRows = (options?.writtenRows ?? []).filter((person) =>
      keptIds.has(person.id),
    );

    this.outreachCacheRealtimeService.notifyProjectCacheUpdated(
      projectId,
      'people',
      writtenRows.length > 0 ? writtenRows : undefined,
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
