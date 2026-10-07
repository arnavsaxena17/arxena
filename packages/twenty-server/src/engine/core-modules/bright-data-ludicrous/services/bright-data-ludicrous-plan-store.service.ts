import { Injectable } from '@nestjs/common';

import { BRIGHT_DATA_PLAN_TTL_MS } from 'src/engine/core-modules/bright-data/ludicrous/constants/bright-data-ludicrous-pricing.const';
import { type BrightDataLudicrousPlan } from 'src/engine/core-modules/bright-data/ludicrous/types/bright-data-ludicrous.types';
import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';

@Injectable()
export class BrightDataLudicrousPlanStoreService {
  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineOutreachCommand)
    private readonly cache: CacheStorageService,
  ) {}

  private key(planId: string): string {
    return `bright-data-ludicrous-plan:${planId}`;
  }

  async save(plan: BrightDataLudicrousPlan): Promise<void> {
    await this.cache.set(this.key(plan.planId), plan, BRIGHT_DATA_PLAN_TTL_MS);
  }

  // A plan belongs to the workspace that paid for its estimate
  async load(
    planId: string,
    workspaceId: string,
  ): Promise<BrightDataLudicrousPlan> {
    const plan = await this.cache.get<BrightDataLudicrousPlan>(
      this.key(planId),
    );

    if (!plan || plan.workspaceId !== workspaceId) {
      throw new Error(
        `Bright Data plan ${planId} was not found or has expired; run the estimate again`,
      );
    }

    return plan;
  }
}
