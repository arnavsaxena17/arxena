import { Injectable, Logger } from '@nestjs/common';

import { FileFolder } from 'twenty-shared/types';
import { v5 } from 'uuid';

import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import {
  OUTREACH_PROJECT_CACHE_FILE_NAMESPACE,
  type OutreachProjectCacheKind,
} from 'src/engine/core-modules/outreach-command/constants/outreach-project-cache.constants';
import { FileStorageService } from 'src/engine/core-modules/file-storage/services/file-storage.service';
import { FileService } from 'src/engine/core-modules/file/services/file.service';

// S3 backup for project Find tabs (gtm-people / gtm-companies). Redis is hot;
// this copy survives cache:flush. Failed backups must not fail the tab write.
@Injectable()
export class OutreachProjectCacheBackupService {
  private readonly logger = new Logger(OutreachProjectCacheBackupService.name);

  constructor(
    private readonly fileStorageService: FileStorageService,
    private readonly fileService: FileService,
    private readonly applicationService: ApplicationService,
  ) {}

  private fileId(
    workspaceId: string,
    kind: OutreachProjectCacheKind,
    projectId: string,
  ): string {
    return v5(
      `${workspaceId}:${kind}:${projectId}`,
      OUTREACH_PROJECT_CACHE_FILE_NAMESPACE,
    );
  }

  private resourcePath(
    kind: OutreachProjectCacheKind,
    projectId: string,
  ): string {
    return `outreach-project-cache/${kind}-${projectId}.json`;
  }

  async write(
    workspaceId: string,
    kind: OutreachProjectCacheKind,
    projectId: string,
    value: unknown,
  ): Promise<void> {
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
        resourcePath: this.resourcePath(kind, projectId),
        fileId: this.fileId(workspaceId, kind, projectId),
        settings: { isTemporaryFile: false, toDelete: false },
      });
    } catch (error) {
      this.logger.warn(
        `Outreach project ${kind} backup to S3 failed (${projectId}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async read<TValue>(
    workspaceId: string,
    kind: OutreachProjectCacheKind,
    projectId: string,
  ): Promise<TValue | undefined> {
    try {
      const file = await this.fileService.getFileContentById({
        fileId: this.fileId(workspaceId, kind, projectId),
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

  async remove(
    workspaceId: string,
    kind: OutreachProjectCacheKind,
    projectId: string,
  ): Promise<void> {
    await this.fileStorageService
      .deleteByFileId({
        fileId: this.fileId(workspaceId, kind, projectId),
        workspaceId,
        fileFolder: FileFolder.AgentChat,
      })
      .catch(() => undefined);
  }
}
