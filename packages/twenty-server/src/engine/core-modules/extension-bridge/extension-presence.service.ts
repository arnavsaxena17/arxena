import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';

import { DataSource, IsNull, type Repository } from 'typeorm';

import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import {
  createExtensionUninstallToken,
  readExtensionUninstallToken,
} from 'src/engine/core-modules/extension-bridge/utils/extension-uninstall-token.util';

const SAFE_SCHEMA_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

@Injectable()
export class ExtensionPresenceService {
  private readonly logger = new Logger(ExtensionPresenceService.name);

  constructor(
    private readonly twentyConfigService: TwentyConfigService,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectDataSource()
    private readonly coreDataSource: DataSource,
  ) {}

  async recordHeartbeat(
    workspaceId: string,
    workspaceMemberId: string,
  ): Promise<{ ok: boolean; uninstallUrl: string | null }> {
    const updated = await this.updateMemberTimestamps(
      workspaceId,
      workspaceMemberId,
      { seen: true },
    );

    if (!updated) {
      return { ok: false, uninstallUrl: null };
    }

    return {
      ok: true,
      uninstallUrl: this.buildUninstallUrl(workspaceId, workspaceMemberId),
    };
  }

  async recordUninstall(token: string | undefined): Promise<boolean> {
    const appSecret = this.twentyConfigService.get('APP_SECRET')?.trim();

    if (!token || !appSecret) {
      return false;
    }

    const payload = readExtensionUninstallToken({ token, appSecret });

    if (!payload) {
      return false;
    }

    return this.updateMemberTimestamps(
      payload.workspaceId,
      payload.workspaceMemberId,
      { uninstalled: true },
    );
  }

  private buildUninstallUrl(
    workspaceId: string,
    workspaceMemberId: string,
  ): string | null {
    const appSecret = this.twentyConfigService.get('APP_SECRET')?.trim();
    const serverUrl = this.twentyConfigService.get('SERVER_URL')?.trim();

    if (!appSecret || !serverUrl) {
      this.logger.warn(
        'Skipping extension uninstall URL because APP_SECRET or SERVER_URL is unset',
      );

      return null;
    }

    const token = createExtensionUninstallToken({
      workspaceId,
      workspaceMemberId,
      appSecret,
    });

    return `${serverUrl.replace(/\/$/, '')}/extension-presence/uninstalled?token=${encodeURIComponent(token)}`;
  }

  private async updateMemberTimestamps(
    workspaceId: string,
    workspaceMemberId: string,
    mode: { seen?: boolean; uninstalled?: boolean },
  ): Promise<boolean> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId, deletedAt: IsNull() },
    });

    if (!workspace) {
      this.logger.warn(
        `Extension presence update skipped, workspace ${workspaceId} not found`,
      );

      return false;
    }

    const schema = this.resolveSchemaName(
      workspaceId,
      workspace.databaseSchema,
    );
    const assignment = mode.uninstalled
      ? `"extensionUninstalledAt" = NOW(), "updatedAt" = NOW()`
      : `"extensionLastSeenAt" = NOW(), "extensionUninstalledAt" = NULL, "updatedAt" = NOW()`;

    try {
      await this.coreDataSource.query(
        `UPDATE ${schema}."workspaceMember"
         SET ${assignment}
         WHERE id = $1`,
        [workspaceMemberId],
      );

      return true;
    } catch (error) {
      this.logger.error(
        `Extension presence update failed for workspace ${workspaceId} member ${workspaceMemberId}`,
        error,
      );

      return false;
    }
  }

  private resolveSchemaName(
    workspaceId: string,
    databaseSchema?: string | null,
  ): string {
    const schema =
      databaseSchema && databaseSchema.trim() !== ''
        ? databaseSchema
        : getWorkspaceSchemaName(workspaceId);

    if (!SAFE_SCHEMA_NAME.test(schema)) {
      throw new Error(`Unsafe workspace schema name: ${schema}`);
    }

    return `"${schema}"`;
  }
}
