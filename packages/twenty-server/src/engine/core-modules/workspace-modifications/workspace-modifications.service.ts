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
async getWorkspaceApiKeys(workspaceId: string): Promise<{
  openaikey?: string;
  twilio_account_sid?: string;
  twilio_auth_token?: string;
  smart_proxy_url?: string;
  whatsapp_key?: string;
  anthropic_key?: string;
  facebook_whatsapp_api_token?: string;
  facebook_whatsapp_phone_number_id?: string;
  facebook_whatsapp_app_id?: string;
}> {
  try {
    // First, ensure all necessary columns exist
    const alterTableQuery = `
      ALTER TABLE core.workspace
      ADD COLUMN IF NOT EXISTS openaikey varchar(255),
      ADD COLUMN IF NOT EXISTS twilio_account_sid varchar(255),
      ADD COLUMN IF NOT EXISTS twilio_auth_token varchar(255),
      ADD COLUMN IF NOT EXISTS smart_proxy_url varchar(255),
      ADD COLUMN IF NOT EXISTS whatsapp_key varchar(255),
      ADD COLUMN IF NOT EXISTS anthropic_key varchar(255),
      ADD COLUMN IF NOT EXISTS facebook_whatsapp_api_token varchar(255),
      ADD COLUMN IF NOT EXISTS facebook_whatsapp_phone_number_id varchar(255),
      ADD COLUMN IF NOT EXISTS facebook_whatsapp_app_id varchar(255)
    `;

    await this.executeRawQuery(alterTableQuery, [], workspaceId);

    // Then proceed with the select query
    const selectQuery = `
      SELECT 
        openaikey,
        twilio_account_sid,
        twilio_auth_token,
        smart_proxy_url,
        whatsapp_key,
        anthropic_key,
        facebook_whatsapp_api_token,
        facebook_whatsapp_phone_number_id,
        facebook_whatsapp_app_id
      FROM core.workspace 
      WHERE id = $1
    `;

    const result = await this.executeRawQuery(selectQuery, [workspaceId], workspaceId);

    if (result && result[0]) {
      return {
        openaikey: result[0].openaikey,
        twilio_account_sid: result[0].twilio_account_sid,
        twilio_auth_token: result[0].twilio_auth_token,
        smart_proxy_url: result[0].smart_proxy_url,
        whatsapp_key: result[0].whatsapp_key,
        anthropic_key: result[0].anthropic_key,
        facebook_whatsapp_api_token: result[0].facebook_whatsapp_api_token,
        facebook_whatsapp_phone_number_id: result[0].facebook_whatsapp_phone_number_id,
        facebook_whatsapp_app_id: result[0].facebook_whatsapp_app_id
      };
    }
    return {};
  } catch (error) {
    console.error(`Error fetching API keys for workspace ${workspaceId}:`, error);
    throw new Error('Failed to fetch workspace API keys');
  }
}
  async getSpecificWorkspaceKey(workspaceId: string, keyName: string): Promise<string | null> {
    try {
      // Convert camelCase to snake_case for database column names
      const columnName = keyName.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      
      const query = `
        SELECT ${columnName}
        FROM core.workspace 
        WHERE id = $1
      `;

      const result = await this.executeRawQuery(query, [workspaceId], workspaceId);

      if (result && result[0]) {
        return result[0][columnName] || null;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching ${keyName} for workspace ${workspaceId}:`, error);
      throw new Error(`Failed to fetch ${keyName}`);
    }
  }

  async checkWorkspaceKeyExists(workspaceId: string, keyName: string): Promise<boolean> {
    const value = await this.getSpecificWorkspaceKey(workspaceId, keyName);
    return value !== null && value !== undefined && value !== '';
  }


  
  async updateWorkspaceApiKeys(
    workspaceId: string,
    keys: {
      openaikey?: string;
      twilio_account_sid?: string;
      twilio_auth_token?: string;
      smart_proxy_url?: string;
      whatsapp_key?: string;
      anthropic_key?: string;
      facebook_whatsapp_api_token?: string;
      facebook_whatsapp_phone_number_id?: string;
      facebook_whatsapp_app_id?: string;
      }
  ): Promise<boolean> {
    try {
      const updates: string[] = [];
      const params: any[] = [];
      let paramCounter = 1;

      Object.entries(keys).forEach(([key, value]) => {
        if (value !== undefined) {
          const columnName = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
          updates.push(`${columnName} = $${paramCounter}`);
          params.push(value);
          paramCounter++;
        }
      });

      if (updates.length === 0) {
        return true;
      }

      params.push(workspaceId);
      const query = `
        UPDATE core.workspace
        SET ${updates.join(', ')}
        WHERE id = $${paramCounter}
      `;

      await this.executeRawQuery(query, params, workspaceId);
      return true;
    } catch (error) {
      console.error(`Error updating API keys for workspace ${workspaceId}:`, error);
      throw new Error('Failed to update workspace API keys');
    }
  }




  
}