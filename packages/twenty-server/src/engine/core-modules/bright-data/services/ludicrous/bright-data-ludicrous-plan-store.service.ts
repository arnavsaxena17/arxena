import { Injectable } from '@nestjs/common';

import { BRIGHT_DATA_PLAN_TTL_MS } from 'src/engine/core-modules/bright-data/ludicrous/constants/bright-data-ludicrous-pricing.const';
import { type BrightDataLudicrousPlan } from 'src/engine/core-modules/bright-data/ludicrous/types/bright-data-ludicrous.types';
import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';

// One active plan per project and entity. The project IS the plan handle: the
// estimate writes it, the fetch reads it, and no list or plan id is exposed.
@Injectable()
export class BrightDataLudicrousPlanStoreService {
  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineOutreachCommand)
    private readonly cache: CacheStorageService,
  ) {}

  private key(workspaceId: string, projectId: string, entity: string): string {
    return `bright-data-ludicrous-plan:${workspaceId}:${projectId}:${entity}`;
  }

  async save(plan: BrightDataLudicrousPlan): Promise<void> {
    await this.cache.set(
      this.key(plan.workspaceId, plan.projectId, plan.entity),
      plan,
      BRIGHT_DATA_PLAN_TTL_MS,
    );
  }

  async load({
    workspaceId,
    projectId,
    entity,
  }: {
    workspaceId: string;
    projectId: string;
    entity: string;
  }): Promise<BrightDataLudicrousPlan> {
    const plan = await this.cache.get<BrightDataLudicrousPlan>(
      this.key(workspaceId, projectId, entity),
    );

    if (!plan || plan.workspaceId !== workspaceId) {
      throw new Error(
        'Bright Data estimate was not found or has expired for this project; run the estimate again',
      );
    }

    return plan;
  }
}
