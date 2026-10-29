import { Injectable, Logger } from '@nestjs/common';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { buildProviderQueryCacheKey } from 'src/engine/core-modules/cache-storage/utils/provider-query-cache-key.util';

export const PROVIDER_QUERY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ProviderQueryCacheService {
  private readonly logger = new Logger(ProviderQueryCacheService.name);
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly ttlMs: number;

  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineProviderQuery)
    private readonly cache: CacheStorageService,
  ) {
    const configuredTtl = Number(
      process.env.PROVIDER_QUERY_CACHE_TTL_MS ?? PROVIDER_QUERY_CACHE_TTL_MS,
    );

    this.ttlMs = Number.isFinite(configuredTtl)
      ? Math.max(0, configuredTtl)
      : PROVIDER_QUERY_CACHE_TTL_MS;
  }

  async get<TValue>(
    prefix: string,
    parts: unknown,
  ): Promise<TValue | undefined> {
    if (this.ttlMs <= 0) {
      return undefined;
    }

    return this.read<TValue>(buildProviderQueryCacheKey(prefix, parts));
  }

  async set<TValue>(
    prefix: string,
    parts: unknown,
    value: TValue,
  ): Promise<void> {
    if (this.ttlMs <= 0) {
      return;
    }

    await this.write(buildProviderQueryCacheKey(prefix, parts), value);
  }

  async getOrFetch<TValue>(
    prefix: string,
    parts: unknown,
    fetcher: () => Promise<TValue>,
  ): Promise<TValue> {
    if (this.ttlMs <= 0) {
      return fetcher();
    }

    const key = buildProviderQueryCacheKey(prefix, parts);
    const digest = key.slice(-12);
    const existing = this.inFlight.get(key);

    if (existing) {
      this.logger.log(
        `Provider query cache COALESCE prefix=${prefix} digest=${digest}`,
      );

      return existing as Promise<TValue>;
    }

    const pending = this.loadOrFetch(key, prefix, digest, fetcher).finally(
      () => {
        this.inFlight.delete(key);
      },
    );

    this.inFlight.set(key, pending);

    return pending;
  }

  private async loadOrFetch<TValue>(
    key: string,
    prefix: string,
    digest: string,
    fetcher: () => Promise<TValue>,
  ): Promise<TValue> {
    const cached = await this.read<TValue>(key);

    if (cached !== undefined) {
      this.logger.log(
        `Provider query cache HIT prefix=${prefix} digest=${digest}`,
      );

      return cached;
    }

    this.logger.log(
      `Provider query cache MISS prefix=${prefix} digest=${digest}`,
    );

    const response = await fetcher();

    await this.write(key, response);

    return response;
  }

  private async read<TValue>(key: string): Promise<TValue | undefined> {
    try {
      return await this.cache.get<TValue>(key);
    } catch (error) {
      this.logger.warn(
        `Provider query cache get failed digest=${key.slice(-12)}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return undefined;
    }
  }

  private async write<TValue>(key: string, value: TValue): Promise<void> {
    try {
      await this.cache.set(key, value, this.ttlMs);
    } catch (error) {
      this.logger.warn(
        `Provider query cache set failed digest=${key.slice(-12)}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
