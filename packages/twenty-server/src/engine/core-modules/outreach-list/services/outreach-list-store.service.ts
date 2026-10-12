import { Injectable, Logger } from '@nestjs/common';

import { FileFolder } from 'twenty-shared/types';
import { v5 } from 'uuid';

import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { FileStorageService } from 'src/engine/core-modules/file-storage/services/file-storage.service';
import { FileService } from 'src/engine/core-modules/file/services/file.service';
import {
  OUTREACH_LIST_FILE_NAMESPACE,
  OUTREACH_LIST_FREE_TTL_MS,
  OUTREACH_LIST_PAID_TTL_MS,
} from 'src/engine/core-modules/outreach-list/outreach-list.constants';
import {
  type OutreachListDocument,
  type OutreachListMeta,
} from 'src/engine/core-modules/outreach-list/outreach-list.types';

// Lists are ephemeral on purpose: Redis is the hot copy and S3 the backup that
// survives a Redis flush, and both stop serving the list once expiresAt passes.
// Turning rows into CRM Company / Person records is a separate, explicit step.
@Injectable()
export class OutreachListStoreService {
  private readonly logger = new Logger(OutreachListStoreService.name);

  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineOutreachCommand)
    private readonly cache: CacheStorageService,
    private readonly fileStorageService: FileStorageService,
    private readonly fileService: FileService,
    private readonly applicationService: ApplicationService,
  ) {}

  private documentKey(workspaceId: string, listId: string): string {
    return `outreach-list:${workspaceId}:${listId}`;
  }

  private indexKey(workspaceId: string): string {
    return `outreach-list-index:${workspaceId}`;
  }

  private fileId(workspaceId: string, name: string): string {
    return v5(`${workspaceId}:${name}`, OUTREACH_LIST_FILE_NAMESPACE);
  }

  ttlMs(paid: boolean): number {
    return paid ? OUTREACH_LIST_PAID_TTL_MS : OUTREACH_LIST_FREE_TTL_MS;
  }

  private isExpired(meta: OutreachListMeta): boolean {
    return Date.parse(meta.expiresAt) <= Date.now();
  }

  async load(
    workspaceId: string,
    listId: string,
  ): Promise<OutreachListDocument | undefined> {
    const cached = await this.cache.get<OutreachListDocument>(
      this.documentKey(workspaceId, listId),
    );
    const document =
      cached ??
      (await this.readFile<OutreachListDocument>(workspaceId, listId));

    if (
      !document ||
      document.meta.workspaceId !== workspaceId ||
      this.isExpired(document.meta)
    ) {
      return undefined;
    }

    return document;
  }

  // Writes both copies and refreshes the expiry from "now"
  async save(document: OutreachListDocument): Promise<OutreachListDocument> {
    const { meta } = document;
    const ttl = this.ttlMs(meta.paid);
    const next: OutreachListDocument = {
      ...document,
      meta: {
        ...meta,
        rowCount: document.rows.length,
        updatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttl).toISOString(),
      },
    };

    await this.cache.set(
      this.documentKey(meta.workspaceId, meta.id),
      next,
      ttl,
    );
    await this.writeFile(meta.workspaceId, `${meta.id}.json`, meta.id, next);
    await this.upsertIndex(next.meta);

    return next;
  }

  async list(workspaceId: string): Promise<OutreachListMeta[]> {
    const metas =
      (await this.cache.get<OutreachListMeta[]>(this.indexKey(workspaceId))) ??
      (await this.readFile<OutreachListMeta[]>(workspaceId, 'index')) ??
      [];

    return metas
      .filter((meta) => !this.isExpired(meta))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async remove(workspaceId: string, listId: string): Promise<void> {
    await this.cache.del(this.documentKey(workspaceId, listId));

    const metas = (await this.list(workspaceId)).filter(
      (meta) => meta.id !== listId,
    );

    await this.cache.set(
      this.indexKey(workspaceId),
      metas,
      OUTREACH_LIST_PAID_TTL_MS,
    );
    await this.writeFile(workspaceId, 'index.json', 'index', metas);
    await this.fileStorageService
      .deleteByFileId({
        fileId: this.fileId(workspaceId, listId),
        workspaceId,
        fileFolder: FileFolder.AgentChat,
      })
      .catch(() => undefined);
  }

  private async upsertIndex(meta: OutreachListMeta): Promise<void> {
    const others = (await this.list(meta.workspaceId)).filter(
      (existing) => existing.id !== meta.id,
    );
    const metas = [meta, ...others];

    await this.cache.set(
      this.indexKey(meta.workspaceId),
      metas,
      OUTREACH_LIST_PAID_TTL_MS,
    );
    await this.writeFile(meta.workspaceId, 'index.json', 'index', metas);
  }

  private async writeFile(
    workspaceId: string,
    filename: string,
    idName: string,
    value: unknown,
  ): Promise<void> {
    // Redis already holds the data; a failed backup must not fail the search
    try {
      const { workspaceCustomFlatApplication } =
        await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
          { workspaceId },
        );

      await this.fileStorageService.writeFile({
        sourceFile: Buffer.from(JSON.stringify(value), 'utf-8'),
        fileFolder: FileFolder.AgentChat,
        applicationUniversalIdentifier:
          workspaceCustomFlatApplication.universalIdentifier,
        workspaceId,
        resourcePath: `outreach-lists/${filename}`,
        fileId: this.fileId(workspaceId, idName),
        settings: { isTemporaryFile: false, toDelete: false },
      });
    } catch (error) {
      this.logger.warn(
        `Outreach list backup to S3 failed (${filename}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async readFile<TValue>(
    workspaceId: string,
    idName: string,
  ): Promise<TValue | undefined> {
    try {
      const file = await this.fileService.getFileContentById({
        fileId: this.fileId(workspaceId, idName),
        workspaceId,
        fileFolder: FileFolder.AgentChat,
      });

      return file === null
        ? undefined
        : (JSON.parse(file.buffer.toString('utf-8')) as TValue);
    } catch {
      return undefined;
    }
  }
}
