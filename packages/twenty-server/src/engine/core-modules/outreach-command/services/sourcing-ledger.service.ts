import { Injectable } from '@nestjs/common';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { type SourcingLedgerEvent } from 'src/engine/core-modules/outreach-command/utils/sourcing-ledger.util';

// Paid sources keep a list 30 days; the ledger that explains it lives as long
const LEDGER_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_EVENTS = 100;

@Injectable()
export class SourcingLedgerService {
  // Appends to one project's ledger at a time, so two events never overwrite
  // each other
  private readonly queues = new Map<string, Promise<unknown>>();

  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineOutreachCommand)
    private readonly cache: CacheStorageService,
  ) {}

  private key(workspaceId: string, projectId: string): string {
    return `sourcing-ledger:${workspaceId}:${projectId}`;
  }

  async read(
    workspaceId: string,
    projectId: string,
  ): Promise<SourcingLedgerEvent[]> {
    return (
      (await this.cache.get<SourcingLedgerEvent[]>(
        this.key(workspaceId, projectId),
      )) ?? []
    );
  }

  // Never throws: a ledger that cannot be written must not fail the run it
  // describes
  async append(
    workspaceId: string,
    projectId: string,
    event: SourcingLedgerEvent,
  ): Promise<void> {
    const key = this.key(workspaceId, projectId);
    const previous = this.queues.get(key) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        const events = await this.read(workspaceId, projectId);

        await this.cache.set(
          key,
          [...events, event].slice(-MAX_EVENTS),
          LEDGER_TTL_MS,
        );
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
