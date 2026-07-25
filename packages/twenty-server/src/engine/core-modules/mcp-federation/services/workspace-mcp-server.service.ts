import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { isDefined, isNonEmptyString } from 'twenty-shared/utils';
import { Repository } from 'typeorm';

import {
  WorkspaceMcpServerEntity,
  WorkspaceMcpToolMode,
} from 'src/engine/core-modules/mcp-federation/entities/workspace-mcp-server.entity';
import {
  DownstreamMcpCachedTool,
  DownstreamMcpConnectionManager,
} from 'src/engine/core-modules/mcp-federation/services/downstream-mcp-connection.manager';
import { SecretEncryptionService } from 'src/engine/core-modules/secret-encryption/secret-encryption.service';

export type CreateWorkspaceMcpServerInput = {
  label: string;
  slug: string;
  url: string;
  authHeaderName?: string;
  authToken?: string;
  enabled?: boolean;
  toolMode?: WorkspaceMcpToolMode;
  toolAllowlist?: string[];
  timeoutMs?: number;
};

export type UpdateWorkspaceMcpServerInput = Partial<CreateWorkspaceMcpServerInput> & {
  id: string;
};

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);

@Injectable()
export class WorkspaceMcpServerService {
  private readonly logger = new Logger(WorkspaceMcpServerService.name);

  constructor(
    @InjectRepository(WorkspaceMcpServerEntity)
    private readonly workspaceMcpServerRepository: Repository<WorkspaceMcpServerEntity>,
    private readonly connectionManager: DownstreamMcpConnectionManager,
    private readonly secretEncryptionService: SecretEncryptionService,
  ) {}

  private toPublic(
    entity: WorkspaceMcpServerEntity,
  ): WorkspaceMcpServerEntity {
    return {
      ...entity,
      hasAuthToken: isNonEmptyString(entity.authTokenEncrypted),
    };
  }

  async list(workspaceId: string): Promise<WorkspaceMcpServerEntity[]> {
    const rows = await this.workspaceMcpServerRepository.find({
      where: { workspaceId },
      order: { createdAt: 'ASC' },
    });

    return rows.map((row) => this.toPublic(row));
  }

  async findEnabled(workspaceId: string): Promise<WorkspaceMcpServerEntity[]> {
    return this.workspaceMcpServerRepository.find({
      where: { workspaceId, enabled: true },
      order: { createdAt: 'ASC' },
    });
  }

  async create(
    workspaceId: string,
    input: CreateWorkspaceMcpServerInput,
  ): Promise<WorkspaceMcpServerEntity> {
    const slug = slugify(input.slug || input.label);

    if (!isNonEmptyString(slug)) {
      throw new Error('Slug is required');
    }

    const entity = this.workspaceMcpServerRepository.create({
      workspaceId,
      label: input.label,
      slug,
      transport: 'streamable-http',
      url: input.url,
      authHeaderName: input.authHeaderName ?? 'Authorization',
      authTokenEncrypted: isNonEmptyString(input.authToken)
        ? this.secretEncryptionService.encrypt(input.authToken)
        : undefined,
      enabled: input.enabled ?? true,
      toolMode: input.toolMode ?? WorkspaceMcpToolMode.ALL,
      toolAllowlist: input.toolAllowlist ?? [],
      timeoutMs: input.timeoutMs ?? 30000,
    });

    const saved = await this.workspaceMcpServerRepository.save(entity);

    return this.syncTools(workspaceId, saved.id);
  }

  async update(
    workspaceId: string,
    input: UpdateWorkspaceMcpServerInput,
  ): Promise<WorkspaceMcpServerEntity> {
    const existing = await this.workspaceMcpServerRepository.findOne({
      where: { id: input.id, workspaceId },
    });

    if (!isDefined(existing)) {
      throw new NotFoundException('MCP server not found');
    }

    if (isDefined(input.label)) {
      existing.label = input.label;
    }

    if (isDefined(input.slug)) {
      existing.slug = slugify(input.slug);
    }

    if (isDefined(input.url)) {
      existing.url = input.url;
    }

    if (isDefined(input.authHeaderName)) {
      existing.authHeaderName = input.authHeaderName;
    }

    if (isNonEmptyString(input.authToken)) {
      existing.authTokenEncrypted = this.secretEncryptionService.encrypt(
        input.authToken,
      );
    }

    if (isDefined(input.enabled)) {
      existing.enabled = input.enabled;
    }

    if (isDefined(input.toolMode)) {
      existing.toolMode = input.toolMode;
    }

    if (isDefined(input.toolAllowlist)) {
      existing.toolAllowlist = input.toolAllowlist;
    }

    if (isDefined(input.timeoutMs)) {
      existing.timeoutMs = input.timeoutMs;
    }

    await this.workspaceMcpServerRepository.save(existing);

    return this.syncTools(workspaceId, existing.id);
  }

  async delete(workspaceId: string, id: string): Promise<boolean> {
    const result = await this.workspaceMcpServerRepository.delete({
      id,
      workspaceId,
    });

    return (result.affected ?? 0) > 0;
  }

  decryptAuthToken(entity: WorkspaceMcpServerEntity): string | undefined {
    if (!isNonEmptyString(entity.authTokenEncrypted)) {
      return undefined;
    }

    return this.secretEncryptionService.decrypt(entity.authTokenEncrypted);
  }

  getCachedTools(entity: WorkspaceMcpServerEntity): DownstreamMcpCachedTool[] {
    if (!Array.isArray(entity.cachedToolsJson)) {
      return [];
    }

    const tools = entity.cachedToolsJson as DownstreamMcpCachedTool[];

    if (entity.toolMode === WorkspaceMcpToolMode.ALLOWLIST) {
      const allow = new Set(entity.toolAllowlist ?? []);

      return tools.filter((tool) => allow.has(tool.name));
    }

    return tools;
  }

  async syncTools(
    workspaceId: string,
    id: string,
  ): Promise<WorkspaceMcpServerEntity> {
    const entity = await this.workspaceMcpServerRepository.findOne({
      where: { id, workspaceId },
    });

    if (!isDefined(entity)) {
      throw new NotFoundException('MCP server not found');
    }

    try {
      const tools = await this.connectionManager.listTools({
        url: entity.url,
        authHeaderName: entity.authHeaderName,
        authToken: this.decryptAuthToken(entity),
        timeoutMs: entity.timeoutMs,
      });

      entity.cachedToolsJson = tools;
      entity.catalogHash = this.connectionManager.hashCatalog(tools);
      entity.lastSyncAt = new Date();
      entity.lastSyncError = undefined;

      const saved = await this.workspaceMcpServerRepository.save(entity);

      this.logger.log(
        `Synced ${tools.length} tools for MCP server ${entity.slug}`,
      );

      return this.toPublic(saved);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      entity.lastSyncError = message;
      await this.workspaceMcpServerRepository.save(entity);
      this.logger.warn(
        `Failed to sync MCP server ${entity.slug}: ${message}`,
      );

      return this.toPublic(entity);
    }
  }
}
