import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WebSocketService } from 'src/modules/websocket/websocket.service';

import { CreateMetaDataStructure } from './object-apis/object-apis-creation';
import { MetadataUpdateService } from './object-apis/services/metadata-update.service';
import { WorkspaceQueryService } from './workspace-modifications.service';

export type WorkspaceBulkMetadataResultItem = {
  workspaceId: string;
  metadataUpdate: unknown;
  indicesCreation: string | null;
  errors: string[];
};

export type WorkspaceBulkMetadataUpdateResult = {
  message: string;
  results: WorkspaceBulkMetadataResultItem[];
};

@Injectable()
export class WorkspaceBulkMetadataUpdateService {
  constructor(
    private readonly workspaceQueryService: WorkspaceQueryService,
    private readonly metadataUpdateService: MetadataUpdateService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly environmentService: EnvironmentService,
    private readonly webSocketService: WebSocketService,
  ) {}

  async updateAllWorkspacesMetadata(
    origin: string | undefined,
  ): Promise<WorkspaceBulkMetadataUpdateResult> {
    const workspaceIds = await this.workspaceQueryService.getWorkspaces();
    const dataSources =
      await this.workspaceQueryService.dataSourceRepository.find({
        where: { workspaceId: In(workspaceIds) },
      });
    const uniqueWorkspaceIds = Array.from(
      new Set(dataSources.map((ds) => ds.workspaceId)),
    );
    const results: WorkspaceBulkMetadataResultItem[] = [];

    for (const workspaceId of uniqueWorkspaceIds) {
      const schema =
        this.workspaceQueryService.workspaceDataSourceService.getSchemaName(
          workspaceId,
        );
      const apiKeys = await this.workspaceQueryService.getApiKeys(
        workspaceId,
        schema,
      );
      if (!apiKeys.length) {
        console.log(
          `No API keys found for workspace ${workspaceId}, skipping...`,
        );
        continue;
      }
      const token =
        await this.workspaceQueryService.apiKeyService.generateApiKeyToken(
          workspaceId,
          apiKeys[0].id,
        );
      if (!token?.token) {
        console.log(
          `Failed to generate token for workspace ${workspaceId}, skipping...`,
        );
        continue;
      }

      const workspaceResult: WorkspaceBulkMetadataResultItem = {
        workspaceId,
        metadataUpdate: null,
        indicesCreation: null,
        errors: [],
      };

      try {
        const metadataResult = await this.metadataUpdateService.updateMetadata(
          token.token,
          origin ?? '',
        );
        workspaceResult.metadataUpdate = metadataResult;
        console.log(
          `Updated metadata for workspace ${workspaceId}:`,
          metadataResult,
        );
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : String(error);
        console.error(
          `Error updating metadata for workspace ${workspaceId}:`,
          error,
        );
        workspaceResult.errors.push(`Metadata update error: ${message}`);
      }

      try {
        const createMetaDataStructure = new CreateMetaDataStructure(
          this.workspaceQueryService,
          this.staticGraphQLService,
          this.environmentService,
          this.webSocketService,
        );
        await createMetaDataStructure.createDatabaseIndices(token.token);
        workspaceResult.indicesCreation = 'Database indices created successfully';
        console.log(`Created database indices for workspace ${workspaceId}`);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : String(error);
        console.error(
          `Error creating database indices for workspace ${workspaceId}:`,
          error,
        );
        workspaceResult.errors.push(`Indices creation error: ${message}`);
      }

      results.push(workspaceResult);
    }

    return {
      message: 'Updated metadata and created indices for all workspaces',
      results,
    };
  }
}
