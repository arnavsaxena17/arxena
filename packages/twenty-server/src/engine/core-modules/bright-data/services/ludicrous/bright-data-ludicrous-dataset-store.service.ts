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
// result is kept here by planId. A later call can write the same rows to a
// project, export them or re-open them without buying them again, even if the
// chat lost the tool output or no project was known at fetch time.
@Injectable()
export class BrightDataLudicrousDatasetStoreService {
  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineOutreachCommand)
    private readonly cache: CacheStorageService,
  ) {}

  private key(planId: string): string {
    return `bright-data-ludicrous-dataset:${planId}`;
  }

  async save(dataset: BrightDataLudicrousDataset): Promise<void> {
    await this.cache.set(
      this.key(dataset.planId),
      dataset,
      BRIGHT_DATA_DATASET_TTL_MS,
    );
  }

  // A dataset belongs to the workspace that paid for it
  async load(
    planId: string,
    workspaceId: string,
  ): Promise<BrightDataLudicrousDataset | undefined> {
    const dataset = await this.cache.get<BrightDataLudicrousDataset>(
      this.key(planId),
    );

    if (!dataset || dataset.workspaceId !== workspaceId) {
      return undefined;
    }

    return dataset;
  }
}
