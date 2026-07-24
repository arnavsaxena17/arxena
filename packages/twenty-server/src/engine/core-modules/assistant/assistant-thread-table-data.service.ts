import { Injectable } from '@nestjs/common';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';

import { AssistantThreadTableData } from './assistant.types';

type CachedTablePayload = {
  columns: string[];
  rows: Record<string, unknown>[];
};

type LastTableDataTablesEntry = {
  ref: string;
  tableId?: string;
  tableType?: string;
  label?: string;
};

@Injectable()
export class AssistantThreadTableDataService {
  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineCandidateSearch)
    private readonly tableDataCache: CacheStorageService,
  ) {}

  /**
   * Resolves persisted lastTableData from Redis when the thread stores
   * table metadata (tables[] or cacheRef) instead of inline rows.
   */
  async resolveLastTableData(
    lastTableData: AssistantThreadTableData | null | undefined,
  ): Promise<unknown> {
    let resolved: unknown = lastTableData ?? null;
    const raw = resolved as Record<string, unknown> | null;

    if (raw?.tables && Array.isArray(raw.tables) && raw.tables.length > 0) {
      const tables = raw.tables as LastTableDataTablesEntry[];
      const lastEntry = tables[tables.length - 1];
      const cached = await this.tableDataCache.get<CachedTablePayload>(
        lastEntry.ref,
      );

      resolved = cached
        ? {
            ...cached,
            tableId: lastEntry.tableId,
            tableType: lastEntry.tableType,
            label: lastEntry.label,
          }
        : null;
    } else if (raw?.cacheRef && typeof raw.cacheRef === 'string') {
      const cached = await this.tableDataCache.get<CachedTablePayload>(
        raw.cacheRef,
      );

      resolved = cached ?? null;
    }

    return resolved;
  }

  async getThreadTable(
    threadId: string,
    tableId: string,
  ): Promise<
    | { columns: string[]; rows: Record<string, unknown>[]; tableId: string }
    | { error: string }
  > {
    const ref = `thread:${threadId}:table:${tableId}`;
    const cached = await this.tableDataCache.get<CachedTablePayload>(ref);

    if (!cached) {
      return { error: 'Table not found or expired' };
    }

    return { columns: cached.columns, rows: cached.rows, tableId };
  }
}
