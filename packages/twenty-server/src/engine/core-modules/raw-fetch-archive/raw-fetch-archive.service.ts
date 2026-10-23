import { Injectable, Logger } from '@nestjs/common';

import { createHash, randomUUID } from 'crypto';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { FileStorageService } from 'src/engine/core-modules/file-storage/services/file-storage.service';
import {
  type RawFetchArchiveEnvelope,
  type RawFetchArchiveInput,
  type RawFetchArchiveResult,
} from 'src/engine/core-modules/raw-fetch-archive/raw-fetch-archive.types';

const RAW_FETCH_S3_FOLDER = 'raw-fetch';
const RAW_FETCH_REDIS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const S3_WRITE_ATTEMPTS = 3;
const S3_RETRY_BASE_DELAY_MS = 200;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const sortValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};

    for (const key of Object.keys(record).sort()) {
      if (record[key] !== undefined) {
        sorted[key] = sortValue(record[key]);
      }
    }

    return sorted;
  }

  return value;
};

const normalizeSegment = (segment: string): string =>
  segment
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'unknown';

// Every paid or rate-limited vendor response is written here the moment it
// arrives, one object per request/page, so a fetched record can always be
// recovered. S3 is the durable copy; Redis is a 7-day hot read path. Archiving
// never throws: losing the archive must not fail the fetch that already paid.
@Injectable()
export class RawFetchArchiveService {
  private readonly logger = new Logger(RawFetchArchiveService.name);

  constructor(
    private readonly fileStorageService: FileStorageService,
    @InjectCacheStorage(CacheStorageNamespace.EngineRawFetchArchive)
    private readonly cache: CacheStorageService,
  ) {}

  buildRequestHash(request: unknown, pageKey?: string | number | null) {
    return createHash('sha256')
      .update(JSON.stringify(sortValue({ request, pageKey: pageKey ?? null })))
      .digest('hex');
  }

  async archive(
    input: RawFetchArchiveInput,
  ): Promise<RawFetchArchiveResult | null> {
    try {
      const requestHash = this.buildRequestHash(input.request, input.pageKey);
      const fetchedAt = new Date();
      const envelope: RawFetchArchiveEnvelope = {
        version: 1,
        provider: input.provider,
        endpoint: input.endpoint,
        workspaceId: input.workspaceId ?? null,
        fetchedAt: fetchedAt.toISOString(),
        pageKey:
          input.pageKey === undefined || input.pageKey === null
            ? null
            : String(input.pageKey),
        requestHash,
        costUsd: input.costUsd ?? null,
        meta: input.meta ?? null,
        request: input.request,
        response: input.response,
      };

      const folder = [
        RAW_FETCH_S3_FOLDER,
        normalizeSegment(input.provider),
        ...input.endpoint.split('/').map(normalizeSegment),
        normalizeSegment(input.workspaceId ?? 'no_workspace'),
        fetchedAt.toISOString().slice(0, 10),
      ].join('/');
      // Time + hash prefix keeps identical repeat requests as separate
      // objects: a re-buy of the same page is still a distinct purchase
      const name = `${fetchedAt.getTime()}-${requestHash.slice(0, 12)}-${randomUUID().slice(0, 8)}.json`;
      const s3Path = `${folder}/${name}`;

      await this.writeHot(input, requestHash, envelope);

      const durable = await this.writeDurable(folder, name, envelope, s3Path);

      return { requestHash, s3Path, durable };
    } catch (error) {
      this.logger.error(
        `Raw fetch archive failed provider=${input.provider} endpoint=${input.endpoint}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
  }

  // Latest archived response for an identical request, without re-buying it
  async readHot(
    provider: RawFetchArchiveInput['provider'],
    endpoint: string,
    requestHash: string,
  ): Promise<RawFetchArchiveEnvelope | undefined> {
    try {
      return await this.cache.get<RawFetchArchiveEnvelope>(
        this.hotKey(provider, endpoint, requestHash),
      );
    } catch {
      return undefined;
    }
  }

  private hotKey(provider: string, endpoint: string, requestHash: string) {
    return `raw-fetch:${provider}:${endpoint}:${requestHash}`;
  }

  private async writeHot(
    input: RawFetchArchiveInput,
    requestHash: string,
    envelope: RawFetchArchiveEnvelope,
  ): Promise<void> {
    try {
      await this.cache.set(
        this.hotKey(input.provider, input.endpoint, requestHash),
        envelope,
        RAW_FETCH_REDIS_TTL_MS,
      );
    } catch (error) {
      this.logger.warn(
        `Raw fetch Redis write failed provider=${input.provider} endpoint=${input.endpoint}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async writeDurable(
    folder: string,
    name: string,
    envelope: RawFetchArchiveEnvelope,
    s3Path: string,
  ): Promise<boolean> {
    const file = Buffer.from(JSON.stringify(envelope));

    for (let attempt = 1; attempt <= S3_WRITE_ATTEMPTS; attempt++) {
      try {
        await this.fileStorageService.write({
          file,
          name,
          folder,
          mimeType: 'application/json',
        });

        return true;
      } catch (error) {
        if (attempt === S3_WRITE_ATTEMPTS) {
          this.logger.error(
            `Raw fetch S3 write FAILED after ${attempt} attempts path=${s3Path}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );

          return false;
        }

        await sleep(S3_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
      }
    }

    return false;
  }
}
