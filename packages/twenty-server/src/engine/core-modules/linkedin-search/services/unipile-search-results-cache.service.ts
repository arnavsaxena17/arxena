import { Injectable, Logger } from '@nestjs/common';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import type { LinkedInSearchResponse } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-response.type';
import {
  buildUnipileSearchResultsCacheKey,
  type UnipileSearchResultsCacheKeyInput,
} from 'src/engine/core-modules/linkedin-search/utils/unipile-search-results-cache-key.util';

export const UNIPILE_SEARCH_RESULTS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class UnipileSearchResultsCacheService {
  private readonly logger = new Logger(UnipileSearchResultsCacheService.name);
  private readonly inFlight = new Map<string, Promise<LinkedInSearchResponse>>();
  private readonly ttlMs: number;

  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineLinkedinSearch)
    private readonly cache: CacheStorageService,
  ) {
    const configuredTtl = Number(
      process.env.UNIPILE_SEARCH_RESULTS_CACHE_TTL_MS ??
        UNIPILE_SEARCH_RESULTS_CACHE_TTL_MS,
    );

    this.ttlMs = Number.isFinite(configuredTtl)
      ? Math.max(0, configuredTtl)
      : UNIPILE_SEARCH_RESULTS_CACHE_TTL_MS;
  }

  async getOrFetch(
    input: UnipileSearchResultsCacheKeyInput,
    fetcher: () => Promise<LinkedInSearchResponse>,
  ): Promise<LinkedInSearchResponse> {
    if (this.ttlMs <= 0 || !input.accountId.trim()) {
      return fetcher();
    }

    const key = buildUnipileSearchResultsCacheKey(input);
    const digest = key.slice(-12);
    const existing = this.inFlight.get(key);

    if (existing) {
      this.logger.log(
        `Unipile search cache COALESCE account=${input.accountId.trim()} digest=${digest}`,
      );

      return existing;
    }

    const pending = this.loadOrFetch(
      key,
      digest,
      input.accountId.trim(),
      fetcher,
    ).finally(() => {
      this.inFlight.delete(key);
    });

    this.inFlight.set(key, pending);

    return pending;
  }

  private async loadOrFetch(
    key: string,
    digest: string,
    accountId: string,
    fetcher: () => Promise<LinkedInSearchResponse>,
  ): Promise<LinkedInSearchResponse> {
    const cached = await this.read(key);

    if (cached) {
      this.logger.log(
        `Unipile search cache HIT account=${accountId} digest=${digest} items=${cached.items?.length ?? 0}`,
      );

      return cached;
    }

    this.logger.log(
      `Unipile search cache MISS account=${accountId} digest=${digest}`,
    );

    const response = await fetcher();
    await this.write(key, response);

    return response;
  }

  private async read(key: string): Promise<LinkedInSearchResponse | undefined> {
    try {
      return await this.cache.get<LinkedInSearchResponse>(key);
    } catch (error) {
      this.logger.warn(
        `Unipile search cache get failed key=${key.slice(-12)}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return undefined;
    }
  }

  private async write(
    key: string,
    response: LinkedInSearchResponse,
  ): Promise<void> {
    try {
      await this.cache.set(key, response, this.ttlMs);
    } catch (error) {
      this.logger.warn(
        `Unipile search cache set failed key=${key.slice(-12)}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
