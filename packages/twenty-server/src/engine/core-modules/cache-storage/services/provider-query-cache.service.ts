import { Injectable, Logger, Optional } from '@nestjs/common';

import { Readable } from 'stream';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { buildProviderQueryCacheKey } from 'src/engine/core-modules/cache-storage/utils/provider-query-cache-key.util';
import { FileStorageService } from 'src/engine/core-modules/file-storage/services/file-storage.service';
import { ProviderCallLogService } from 'src/engine/core-modules/provider-call-log/services/provider-call-log.service';

export const PROVIDER_QUERY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PROVIDER_QUERY_S3_FOLDER = 'provider-query-cache';
// Durable S3 copy has no age cut-off by default (same idea as LinkedIn profiles)
const PROVIDER_QUERY_S3_MAX_AGE_MS = Number.POSITIVE_INFINITY;

type ProviderQueryCacheEnvelope<TValue> = {
  version: 1;
  fetchedAt: string;
  key: string;
  // The hashed request, so a cache file can be read back as the query that
  // produced it (absent on files written before it was kept)
  parts?: unknown;
  value: TValue;
};

type CacheRead<TValue> = { value: TValue; source: 'redis_hit' | 's3_hit' };

type ProviderQueryCacheOptions = {
  // What identifies the request for caching, when it differs from what we
  // record. A company is recorded as the user typed it and cached by its
  // identity, so two spellings share one entry while the ledger keeps both.
  keyParts?: unknown;
  // The fetcher records the provider request itself (Business Search does, per
  // attempt). The cache then logs only what a fetch cannot: a hit, or a wait on
  // another caller's fetch, so one paid request never lands twice in the ledger
  fetcherLogsRequest?: boolean;
};

@Injectable()
export class ProviderQueryCacheService {
  private readonly logger = new Logger(ProviderQueryCacheService.name);
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly ttlMs: number;
  private readonly s3MaxAgeMs: number;

  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineProviderQuery)
    private readonly cache: CacheStorageService,
    @Optional()
    private readonly fileStorageService?: FileStorageService,
    @Optional()
    private readonly providerCallLog?: ProviderCallLogService,
  ) {
    const configuredTtl = Number(
      process.env.PROVIDER_QUERY_CACHE_TTL_MS ?? PROVIDER_QUERY_CACHE_TTL_MS,
    );

    this.ttlMs = Number.isFinite(configuredTtl)
      ? Math.max(0, configuredTtl)
      : PROVIDER_QUERY_CACHE_TTL_MS;

    const configuredS3MaxAge = Number(
      process.env.PROVIDER_QUERY_CACHE_S3_MAX_AGE_MS ??
        PROVIDER_QUERY_S3_MAX_AGE_MS,
    );

    this.s3MaxAgeMs = Number.isFinite(configuredS3MaxAge)
      ? Math.max(0, configuredS3MaxAge)
      : PROVIDER_QUERY_S3_MAX_AGE_MS;
  }

  async get<TValue>(
    prefix: string,
    parts: unknown,
  ): Promise<TValue | undefined> {
    if (this.ttlMs <= 0) {
      return undefined;
    }

    const key = buildProviderQueryCacheKey(prefix, parts);
    const cached = await this.read<TValue>(key, prefix);

    // A miss is not logged here: the caller fetches and calls set(), which
    // logs the provider request
    if (cached !== undefined) {
      this.logCall(prefix, parts, key, cached.source, cached.value);
    }

    return cached?.value;
  }

  async set<TValue>(
    prefix: string,
    parts: unknown,
    value: TValue,
  ): Promise<void> {
    if (this.ttlMs <= 0) {
      return;
    }

    const key = buildProviderQueryCacheKey(prefix, parts);

    await this.write(key, prefix, parts, value);
    this.logCall(prefix, parts, key, 'fetched', value);
  }

  async getOrFetch<TValue>(
    prefix: string,
    parts: unknown,
    fetcher: () => Promise<TValue>,
    options: ProviderQueryCacheOptions = {},
  ): Promise<TValue> {
    if (this.ttlMs <= 0) {
      return this.providerCallLog
        ? this.providerCallLog.track(
            {
              provider: this.providerOf(prefix),
              operation: prefix,
              request: parts,
            },
            fetcher,
          )
        : fetcher();
    }

    const key = buildProviderQueryCacheKey(prefix, options.keyParts ?? parts);
    const digest = key.slice(-12);
    const existing = this.inFlight.get(key);

    if (existing) {
      this.logger.log(
        `Provider query cache COALESCE prefix=${prefix} digest=${digest}`,
      );
      this.logCall(prefix, parts, key, 'coalesced');

      return existing as Promise<TValue>;
    }

    const pending = this.loadOrFetch(
      key,
      prefix,
      parts,
      digest,
      fetcher,
      options,
    ).finally(() => {
      this.inFlight.delete(key);
    });

    this.inFlight.set(key, pending);

    return pending;
  }

  private async loadOrFetch<TValue>(
    key: string,
    prefix: string,
    parts: unknown,
    digest: string,
    fetcher: () => Promise<TValue>,
    options: ProviderQueryCacheOptions,
  ): Promise<TValue> {
    const cached = await this.read<TValue>(key, prefix);

    if (cached !== undefined) {
      this.logger.log(
        `Provider query cache HIT prefix=${prefix} digest=${digest}`,
      );
      this.logCall(prefix, parts, key, cached.source, cached.value);

      return cached.value;
    }

    this.logger.log(
      `Provider query cache MISS prefix=${prefix} digest=${digest}`,
    );

    const startedAt = Date.now();
    let response: TValue;

    try {
      response = await fetcher();
    } catch (error) {
      // The fetcher's own ledger row already recorded this failure
      if (options.fetcherLogsRequest !== true) {
        this.logCall(prefix, parts, key, 'error', undefined, {
          durationMs: Date.now() - startedAt,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }

      throw error;
    }

    await this.write(key, prefix, parts, response);

    if (options.fetcherLogsRequest !== true) {
      this.logCall(prefix, parts, key, 'fetched', response, {
        durationMs: Date.now() - startedAt,
      });
    }

    return response;
  }

  private async read<TValue>(
    key: string,
    prefix: string,
  ): Promise<CacheRead<TValue> | undefined> {
    const fromRedis = await this.readRedis<TValue>(key);

    if (fromRedis !== undefined) {
      return { value: fromRedis, source: 'redis_hit' };
    }

    const fromS3 = await this.readS3<TValue>(key, prefix);

    if (fromS3 === undefined) {
      return undefined;
    }

    // Rehydrate the hot path so the next hit skips S3
    await this.writeRedis(key, fromS3);

    return { value: fromS3, source: 's3_hit' };
  }

  private async write<TValue>(
    key: string,
    prefix: string,
    parts: unknown,
    value: TValue,
  ): Promise<void> {
    await Promise.all([
      this.writeRedis(key, value),
      this.writeS3(key, prefix, parts, value),
    ]);
  }

  private logCall(
    prefix: string,
    parts: unknown,
    key: string,
    cacheStatus: 'redis_hit' | 's3_hit' | 'coalesced' | 'fetched' | 'error',
    response?: unknown,
    extra: { durationMs?: number; errorMessage?: string } = {},
  ): void {
    if (!this.providerCallLog) {
      return;
    }

    const { folder, filename } = this.s3Location(key, prefix);

    this.providerCallLog.record({
      provider: this.providerOf(prefix),
      operation: prefix,
      request: parts,
      cacheKey: key,
      cacheStatus,
      response,
      // An error leaves nothing in storage to point at
      responseLocation:
        cacheStatus === 'error' ? undefined : `${folder}/${filename}`,
      ...extra,
    });
  }

  // 'bright-data-search:v1' -> 'bright-data-search'
  private providerOf(prefix: string): string {
    return prefix.split(':')[0] || prefix;
  }

  private async readRedis<TValue>(key: string): Promise<TValue | undefined> {
    try {
      return await this.cache.get<TValue>(key);
    } catch (error) {
      this.logger.warn(
        `Provider query Redis get failed digest=${key.slice(-12)}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return undefined;
    }
  }

  private async writeRedis<TValue>(key: string, value: TValue): Promise<void> {
    try {
      await this.cache.set(key, value, this.ttlMs);
    } catch (error) {
      this.logger.warn(
        `Provider query Redis set failed digest=${key.slice(-12)}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async readS3<TValue>(
    key: string,
    prefix: string,
  ): Promise<TValue | undefined> {
    if (!this.fileStorageService || this.s3MaxAgeMs <= 0) {
      return undefined;
    }

    const { folder, filename } = this.s3Location(key, prefix);

    try {
      const stream = await this.fileStorageService.read({
        folderPath: folder,
        filename,
      });
      const content = await this.streamToString(stream);
      const envelope = JSON.parse(
        content,
      ) as ProviderQueryCacheEnvelope<TValue>;

      if (!this.isFresh(envelope.fetchedAt)) {
        this.logger.log(
          `Provider query S3 STALE prefix=${prefix} digest=${key.slice(-12)}`,
        );

        return undefined;
      }

      this.logger.log(
        `Provider query S3 HIT prefix=${prefix} digest=${key.slice(-12)}`,
      );

      return envelope.value;
    } catch (error) {
      this.logger.log(
        `Provider query S3 MISS prefix=${prefix} digest=${key.slice(-12)}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return undefined;
    }
  }

  private async writeS3<TValue>(
    key: string,
    prefix: string,
    parts: unknown,
    value: TValue,
  ): Promise<void> {
    if (!this.fileStorageService || this.s3MaxAgeMs <= 0) {
      return;
    }

    const { folder, filename } = this.s3Location(key, prefix);
    const envelope: ProviderQueryCacheEnvelope<TValue> = {
      version: 1,
      fetchedAt: new Date().toISOString(),
      key,
      parts,
      value,
    };

    try {
      await this.fileStorageService.write({
        file: Buffer.from(JSON.stringify(envelope)),
        name: filename,
        folder,
        mimeType: 'application/json',
      });
    } catch (error) {
      this.logger.warn(
        `Provider query S3 set failed prefix=${prefix} digest=${key.slice(-12)}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private s3Location(
    key: string,
    prefix: string,
  ): { folder: string; filename: string } {
    const digest = key.includes(':')
      ? key.slice(key.lastIndexOf(':') + 1)
      : key;
    const folder = `${PROVIDER_QUERY_S3_FOLDER}/${this.normalizeSegment(prefix)}`;

    return { folder, filename: `${digest}.json` };
  }

  private normalizeSegment(segment: string): string {
    return (
      segment
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'unknown'
    );
  }

  private isFresh(fetchedAt: string | undefined): boolean {
    if (!Number.isFinite(this.s3MaxAgeMs)) {
      return true;
    }

    if (!fetchedAt?.trim()) {
      return false;
    }

    const fetchedAtMs = Date.parse(fetchedAt);

    if (Number.isNaN(fetchedAtMs)) {
      return false;
    }

    return Date.now() - fetchedAtMs <= this.s3MaxAgeMs;
  }

  private streamToString(stream: Readable): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Uint8Array[] = [];

      stream.on('data', (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.from(chunk as string);

        chunks.push(new Uint8Array(buffer));
      });
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      stream.on('error', reject);
    });
  }
}
