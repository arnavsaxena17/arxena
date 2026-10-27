import { Injectable } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { type OutreachTableTab } from 'src/engine/core-modules/outreach-command/utils/outreach-cache-realtime.constants';

const WRITES_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_IDS = 5000;

@Injectable()
export class ChatTabWritesService {
  private readonly queues = new Map<string, Promise<unknown>>();

  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineOutreachCommand)
    private readonly cache: CacheStorageService,
  ) {}

  private key(
    threadId: string,
    projectId: string,
    tab: OutreachTableTab,
  ): string {
    return `chat-tab-writes:${threadId}:${projectId}:${tab}`;
  }

  async read(
    threadId: string | undefined,
    projectId: string,
    tab: OutreachTableTab,
  ): Promise<string[]> {
    if (!isNonEmptyString(threadId)) {
      return [];
    }

    return (
      (await this.cache.get<string[]>(
        this.key(threadId, projectId, tab),
      )) ?? []
    );
  }

  // Never throws: remembering writes must not fail the upsert that produced them
  async append(
    threadId: string | undefined,
    projectId: string,
    tab: OutreachTableTab,
    rowIds: string[],
  ): Promise<void> {
    if (!isNonEmptyString(threadId) || rowIds.length === 0) {
      return;
    }

    const key = this.key(threadId, projectId, tab);
    const previous = this.queues.get(key) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        const existing = (await this.cache.get<string[]>(key)) ?? [];
        const merged = [...new Set([...existing, ...rowIds])].slice(-MAX_IDS);

        await this.cache.set(key, merged, WRITES_TTL_MS);
      })
      .catch(() => undefined);

    this.queues.set(key, next);
    void next.then(() => {
      if (this.queues.get(key) === next) {
        this.queues.delete(key);
      }
    });

    await next;
  }
}
