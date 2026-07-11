import { Injectable, Logger } from '@nestjs/common';

import { Readable } from 'stream';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { FileStorageService } from 'src/engine/core-modules/file-storage/file-storage.service';

import {
  ORG_CHART_PUBLISHED_INDEX_FILENAME,
  ORG_CHART_PUBLISHED_S3_FOLDER,
  orgPublishedSlugCacheKey,
  orgPublishedSlugS3Filename,
  type OrgPublishedSlugIndex,
  type OrgPublishedSlugManifest,
  type OrgPublishedSlugMapping,
} from '../utils/org-chart-published-slug.util';

@Injectable()
export class OrgChartPublishedSlugService {
  private readonly logger = new Logger(OrgChartPublishedSlugService.name);

  constructor(
    private readonly fileStorageService: FileStorageService,
    @InjectCacheStorage(CacheStorageNamespace.EngineOrgChart)
    private readonly orgChartCacheStorageService: CacheStorageService,
  ) {}

  async getPublishedSlugMapping(
    publishSlug: string,
  ): Promise<OrgPublishedSlugMapping | null> {
    const trimmedSlug = publishSlug.trim();
    if (!trimmedSlug) {
      return null;
    }

    const fromS3 = await this.readSlugManifestFromS3(trimmedSlug);
    if (fromS3 && !this.isExpired(fromS3)) {
      return this.toMapping(fromS3);
    }

    const fromRedis =
      await this.orgChartCacheStorageService.get<OrgPublishedSlugMapping>(
        orgPublishedSlugCacheKey(trimmedSlug),
      );

    if (!fromRedis?.companyId?.trim() || this.isExpired(fromRedis)) {
      return null;
    }

    this.logger.log(
      `Migrating published slug mapping from Redis to S3 publishSlug=${trimmedSlug}`,
    );
    await this.savePublishedSlugMapping({
      publishSlug: trimmedSlug,
      mapping: fromRedis,
      expiresAt: fromRedis.expiresAt ?? null,
    });

    return fromRedis;
  }

  async savePublishedSlugMapping(input: {
    publishSlug: string;
    mapping: OrgPublishedSlugMapping;
    expiresAt?: string | null;
  }): Promise<void> {
    const publishSlug = input.publishSlug.trim();
    const companyId = input.mapping.companyId.trim();

    if (!publishSlug || !companyId) {
      return;
    }

    const manifest: OrgPublishedSlugManifest = {
      publishSlug,
      companyId,
      companyName: input.mapping.companyName?.trim() || undefined,
      workspaceId: input.mapping.workspaceId,
      publishedAt: input.mapping.publishedAt,
      expiresAt: input.expiresAt ?? input.mapping.expiresAt ?? null,
    };

    await this.fileStorageService.write({
      file: Buffer.from(JSON.stringify(manifest, null, 2)),
      name: orgPublishedSlugS3Filename(publishSlug),
      folder: ORG_CHART_PUBLISHED_S3_FOLDER,
      mimeType: 'application/json',
    });

    await this.upsertSlugInIndex(publishSlug);

    this.logger.log(
      `Saved published slug manifest to S3 publishSlug=${publishSlug} companyId=${companyId}`,
    );
  }

  async deletePublishedSlugMapping(publishSlug: string): Promise<void> {
    const trimmedSlug = publishSlug.trim();
    if (!trimmedSlug) {
      return;
    }

    try {
      await this.fileStorageService.delete({
        folderPath: ORG_CHART_PUBLISHED_S3_FOLDER,
        filename: orgPublishedSlugS3Filename(trimmedSlug),
      });
    } catch (error) {
      this.logger.warn(
        `Failed to delete published slug manifest from S3 publishSlug=${trimmedSlug}`,
        error as Error,
      );
    }

    await this.removeSlugFromIndex(trimmedSlug);

    await this.orgChartCacheStorageService.del(
      orgPublishedSlugCacheKey(trimmedSlug),
    );
  }

  async listPublishedSlugs(): Promise<string[]> {
    const index = await this.readIndexFromS3();
    const slugsFromIndex = index?.slugs ?? [];

    if (slugsFromIndex.length > 0) {
      return [...slugsFromIndex].sort((left, right) =>
        left.localeCompare(right),
      );
    }

    const legacySlugs = await this.listPublishedSlugsFromLegacyRedis();
    if (legacySlugs.length === 0) {
      return [];
    }

    this.logger.log(
      `Rebuilding published slug index in S3 from ${legacySlugs.length} legacy Redis mapping(s)`,
    );

    for (const publishSlug of legacySlugs) {
      const mapping = await this.getPublishedSlugMapping(publishSlug);
      if (mapping) {
        await this.savePublishedSlugMapping({
          publishSlug,
          mapping,
          expiresAt: mapping.expiresAt ?? null,
        });
      }
    }

    const rebuiltIndex = await this.readIndexFromS3();

    return [...(rebuiltIndex?.slugs ?? [])].sort((left, right) =>
      left.localeCompare(right),
    );
  }

  private async readSlugManifestFromS3(
    publishSlug: string,
  ): Promise<OrgPublishedSlugManifest | null> {
    try {
      const stream = await this.fileStorageService.read({
        folderPath: ORG_CHART_PUBLISHED_S3_FOLDER,
        filename: orgPublishedSlugS3Filename(publishSlug),
      });
      const content = await this.streamToString(stream);
      const parsed = JSON.parse(content) as OrgPublishedSlugManifest;
      const companyId = parsed?.companyId?.trim() ?? '';

      if (!companyId || !parsed.workspaceId?.trim()) {
        return null;
      }

      return {
        publishSlug: parsed.publishSlug?.trim() || publishSlug,
        companyId,
        companyName: parsed.companyName?.trim() || undefined,
        workspaceId: parsed.workspaceId.trim(),
        publishedAt: parsed.publishedAt,
        expiresAt: parsed.expiresAt ?? null,
      };
    } catch {
      return null;
    }
  }

  private async readIndexFromS3(): Promise<OrgPublishedSlugIndex | null> {
    try {
      const stream = await this.fileStorageService.read({
        folderPath: ORG_CHART_PUBLISHED_S3_FOLDER,
        filename: ORG_CHART_PUBLISHED_INDEX_FILENAME,
      });
      const content = await this.streamToString(stream);
      const parsed = JSON.parse(content) as OrgPublishedSlugIndex;
      const slugs = Array.isArray(parsed?.slugs)
        ? parsed.slugs.filter(
            (slug): slug is string =>
              typeof slug === 'string' && slug.trim().length > 0,
          )
        : [];

      return {
        slugs,
        updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  private async writeIndexToS3(slugs: string[]): Promise<void> {
    const uniqueSortedSlugs = [...new Set(slugs.map((slug) => slug.trim()))]
      .filter((slug) => slug.length > 0)
      .sort((left, right) => left.localeCompare(right));

    const index: OrgPublishedSlugIndex = {
      slugs: uniqueSortedSlugs,
      updatedAt: new Date().toISOString(),
    };

    await this.fileStorageService.write({
      file: Buffer.from(JSON.stringify(index, null, 2)),
      name: ORG_CHART_PUBLISHED_INDEX_FILENAME,
      folder: ORG_CHART_PUBLISHED_S3_FOLDER,
      mimeType: 'application/json',
    });
  }

  private async upsertSlugInIndex(publishSlug: string): Promise<void> {
    const index = await this.readIndexFromS3();
    const slugs = index?.slugs ?? [];

    if (!slugs.includes(publishSlug)) {
      slugs.push(publishSlug);
    }

    await this.writeIndexToS3(slugs);
  }

  private async removeSlugFromIndex(publishSlug: string): Promise<void> {
    const index = await this.readIndexFromS3();
    const slugs = (index?.slugs ?? []).filter((slug) => slug !== publishSlug);

    await this.writeIndexToS3(slugs);
  }

  private async listPublishedSlugsFromLegacyRedis(): Promise<string[]> {
    const logicalKeys =
      await this.orgChartCacheStorageService.scanKeysByLogicalPattern(
        'org-published:*',
      );

    return logicalKeys
      .map((logicalKey) =>
        logicalKey.startsWith('org-published:')
          ? logicalKey.slice('org-published:'.length)
          : '',
      )
      .filter((slug) => slug.length > 0)
      .sort((left, right) => left.localeCompare(right));
  }

  private isExpired(mapping: OrgPublishedSlugMapping): boolean {
    const expiresAt = mapping.expiresAt?.trim();
    if (!expiresAt) {
      return false;
    }

    const expiresAtMs = Date.parse(expiresAt);
    if (!Number.isFinite(expiresAtMs)) {
      return false;
    }

    return expiresAtMs <= Date.now();
  }

  private toMapping(
    manifest: OrgPublishedSlugManifest,
  ): OrgPublishedSlugMapping {
    return {
      companyId: manifest.companyId,
      companyName: manifest.companyName,
      workspaceId: manifest.workspaceId,
      publishedAt: manifest.publishedAt,
      expiresAt: manifest.expiresAt ?? null,
    };
  }

  private streamToString(stream: Readable): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Uint8Array[] = [];

      stream.on('data', (chunk: Buffer | string) => {
        const buf = Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.from(chunk as string);

        chunks.push(new Uint8Array(buf));
      });
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      stream.on('error', reject);
    });
  }
}
