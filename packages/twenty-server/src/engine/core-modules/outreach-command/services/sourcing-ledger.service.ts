import { Injectable } from '@nestjs/common';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { OutreachProjectCacheBackupService } from 'src/engine/core-modules/outreach-command/services/outreach-project-cache-backup.service';
import { type SourcingLedgerEvent } from 'src/engine/core-modules/outreach-command/utils/sourcing-ledger.util';

// Paid sources keep a list 30 days; the ledger that explains it lives as long
const LEDGER_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// Room for a run's checkpoints next to the brief and the scoring events
const MAX_EVENTS = 200;

@Injectable()
export class SourcingLedgerService {
  // Appends to one project's ledger at a time, so two events never overwrite
  // each other
  private readonly queues = new Map<string, Promise<unknown>>();

  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineOutreachCommand)
    private readonly cache: CacheStorageService,
    // Optional so the service still works where no backup is wired (tests)
    private readonly backupService?: OutreachProjectCacheBackupService,
  ) {}

  private key(workspaceId: string, projectId: string): string {
    return `sourcing-ledger:${workspaceId}:${projectId}`;
  }

  // A run outlives Redis evictions and cache flushes: a miss falls back to the
  // S3 copy, and every read pushes the expiry out so an active run never lapses
  async read(
    workspaceId: string,
    projectId: string,
  ): Promise<SourcingLedgerEvent[]> {
    const key = this.key(workspaceId, projectId);
    const cached = await this.cache.get<SourcingLedgerEvent[]>(key);

    if (cached !== undefined && cached !== null) {
      await this.cache.set(key, cached, LEDGER_TTL_MS).catch(() => undefined);

      return cached;
    }

    const restored = await this.backupService?.read<SourcingLedgerEvent[]>(
      workspaceId,
      'sourcing-ledger',
      projectId,
    );

    if (restored === undefined || !Array.isArray(restored)) {
      return [];
    }

    await this.cache.set(key, restored, LEDGER_TTL_MS).catch(() => undefined);

    return restored;
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
        const updated = [...events, event].slice(-MAX_EVENTS);

        await this.cache.set(key, updated, LEDGER_TTL_MS);
        await this.backupService?.write(
          workspaceId,
          'sourcing-ledger',
          projectId,
          updated,
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
