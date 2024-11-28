import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { EntityManager, In, Repository } from 'typeorm';
import { EnvironmentService } from 'src/engine/integrations/environment/environment.service';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';
import { TokenService } from 'src/engine/core-modules/auth/services/token.service';

@Injectable()
export class WorkspaceQueryService {
  constructor(
    @InjectRepository(Workspace, 'core')
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(DataSourceEntity, 'metadata')
    private readonly dataSourceRepository: Repository<DataSourceEntity>,
    public readonly tokenService: TokenService,

    private readonly environmentService: EnvironmentService,
    private readonly workspaceDataSourceService: WorkspaceDataSourceService,
  ) {}

  async executeQueryAcrossWorkspaces<T>(
    queryCallback: (workspaceId: string, dataSourceSchema: string, transactionManager?: EntityManager) => Promise<T>,
    transactionManager?: EntityManager
  ): Promise<T[]> {
    const workspaceIds = await this.getWorkspaces();
    const dataSources = await this.dataSourceRepository.find({
      where: {
        workspaceId: In(workspaceIds),
      },
    });
    
    const results: T[] = [];
    const workspaceIdsWithDataSources = new Set(
      dataSources.map((dataSource) => dataSource.workspaceId),
    );

    for (const workspaceId of workspaceIdsWithDataSources) {
      const dataSourceSchema = this.workspaceDataSourceService.getSchemaName(workspaceId);
      const result = await queryCallback(workspaceId, dataSourceSchema, transactionManager);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  async executeRawQuery(query: string, params: any[], workspaceId: string, transactionManager?: EntityManager) {
    return this.workspaceDataSourceService.executeRawQuery(query, params, workspaceId, transactionManager);
  }

  private async getWorkspaces(): Promise<string[]> {
    const workspaceIds = (
      await this.workspaceRepository.find({
        where: this.environmentService.get('IS_BILLING_ENABLED')
          ? { subscriptionStatus: In(['active', 'trialing', 'past_due']) }
          : {},
        select: ['id'],
      })
    ).map((workspace) => workspace.id);
    return workspaceIds;
  }


  // Add this method to the service
  async getApiKeys(workspaceId: string, dataSourceSchema: string, transactionManager?: EntityManager) {
    try {
      const apiKeys = await this.workspaceDataSourceService.executeRawQuery(
        `SELECT * FROM ${dataSourceSchema}."apiKey" where "apiKey"."revokedAt" IS NULL ORDER BY "apiKey"."createdAt" ASC`,
        [],
        workspaceId,
        transactionManager,
      );
      return apiKeys;
    } catch (e) {
      console.log("Error in  ID", workspaceId, "for dataSourceSchema", dataSourceSchema);
      return [];
    }
  }

  // Helper method to get API key token
  async getApiKeyToken(workspaceId: string, dataSourceSchema: string, transactionManager?: EntityManager) {
    const apiKeys = await this.getApiKeys(workspaceId, dataSourceSchema, transactionManager);
    if (apiKeys.length > 0) {
      return this.tokenService.generateApiKeyToken(
        workspaceId,
        apiKeys[0].id,
        apiKeys[0].expiresAt
      );
    }
    return null;
  }




  
}