import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { FeatureFlagMap } from 'src/engine/core-modules/feature-flag/interfaces/feature-flag-map.interface';

import { FeatureFlagKey } from 'src/engine/core-modules/feature-flag/enums/feature-flag-key.enum';
import { FeatureFlag } from 'src/engine/core-modules/feature-flag/feature-flag.entity';

@Injectable()
export class FeatureFlagService {
  private featureFlagCache = new Map<string, { flags: FeatureFlagMap; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

  constructor(
    @InjectRepository(FeatureFlag, 'core')
    private readonly featureFlagRepository: Repository<FeatureFlag>,
  ) {}

  public async isFeatureEnabled(
    key: FeatureFlagKey,
    workspaceId: string,
  ): Promise<boolean> {
    const featureFlag = await this.featureFlagRepository.findOneBy({
      workspaceId,
      key,
      value: true,
    });

    return !!featureFlag?.value;
  }

  public async getWorkspaceFeatureFlags(
    workspaceId: string,
  ): Promise<FeatureFlag[]> {
    return this.featureFlagRepository.find({ where: { workspaceId } });
  }

  public async getWorkspaceFeatureFlagsMap(
    workspaceId: string,
  ): Promise<FeatureFlagMap> {
    // Check cache first
    const cached = this.featureFlagCache.get(workspaceId);
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
      return cached.flags;
    }

    const workspaceFeatureFlags =
      await this.getWorkspaceFeatureFlags(workspaceId);

    const workspaceFeatureFlagsMap = workspaceFeatureFlags.reduce(
      (result, currentFeatureFlag) => {
        result[currentFeatureFlag.key] = currentFeatureFlag.value;

        return result;
      },
      {} as FeatureFlagMap,
    );

    // Cache the result
    this.featureFlagCache.set(workspaceId, {
      flags: workspaceFeatureFlagsMap,
      timestamp: now,
    });

    return workspaceFeatureFlagsMap;
  }

  public async enableFeatureFlags(
    keys: FeatureFlagKey[],
    workspaceId: string,
  ): Promise<void> {
    await this.featureFlagRepository.upsert(
      keys.map((key) => ({ workspaceId, key, value: true })),
      {
        conflictPaths: ['workspaceId', 'key'],
        skipUpdateIfNoValuesChanged: true,
      },
    );
    
    // Invalidate cache
    this.featureFlagCache.delete(workspaceId);
  }

  // Method to clear cache for a specific workspace
  public clearCache(workspaceId: string): void {
    this.featureFlagCache.delete(workspaceId);
  }

  // Method to clear all cache
  public clearAllCache(): void {
    this.featureFlagCache.clear();
  }
}
