import { Injectable } from '@nestjs/common';

import { BRIGHT_DATA_DATASET_TTL_MS } from 'src/engine/core-modules/bright-data/ludicrous/constants/bright-data-ludicrous-pricing.const';
import { type BrightDataLudicrousRunResult } from 'src/engine/core-modules/bright-data/ludicrous/types/bright-data-ludicrous.types';
import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';

export type BrightDataLudicrousDataset = BrightDataLudicrousRunResult & {
  workspaceId: string;
  rawQuery?: string;
  createdAt: string;
};

// Records are paid for ($0.002 each) the moment they are fetched, so the run
// result is kept per project and entity. A later fetch can reuse the same rows
// without buying them again. A new estimate clears it, because a changed query
// must not return the previous query's rows.
@Injectable()
export class BrightDataLudicrousDatasetStoreService {
  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineOutreachCommand)
    private readonly cache: CacheStorageService,
  ) {}

  private key(workspaceId: string, projectId: string, entity: string): string {
    return `bright-data-ludicrous-dataset:${workspaceId}:${projectId}:${entity}`;
  }

  async save(dataset: BrightDataLudicrousDataset): Promise<void> {
    await this.cache.set(
      this.key(dataset.workspaceId, dataset.projectId, dataset.entity),
      dataset,
      BRIGHT_DATA_DATASET_TTL_MS,
    );
  }

  // A dataset belongs to the workspace that paid for it
  async load({
    workspaceId,
    projectId,
    entity,
  }: {
    workspaceId: string;
    projectId: string;
    entity: string;
  }): Promise<BrightDataLudicrousDataset | undefined> {
    const dataset = await this.cache.get<BrightDataLudicrousDataset>(
      this.key(workspaceId, projectId, entity),
    );

    if (!dataset || dataset.workspaceId !== workspaceId) {
      return undefined;
    }

    return dataset;
  }

  async clear({
    workspaceId,
    projectId,
    entity,
  }: {
    workspaceId: string;
    projectId: string;
    entity: string;
  }): Promise<void> {
    await this.cache.del(this.key(workspaceId, projectId, entity));
  }
}
