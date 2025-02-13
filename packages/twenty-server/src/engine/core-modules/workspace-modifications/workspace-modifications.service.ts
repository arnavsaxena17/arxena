import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { EnvironmentService } from 'src/engine/integrations/environment/environment.service';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';
import { TokenService } from 'src/engine/core-modules/auth/services/token.service';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
// import { WorkspaceQueryService } from '../workspace-query.service';

@Injectable()
export class WorkspaceQueryService {
  constructor(

    @InjectRepository(Workspace, 'core')
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(DataSourceEntity, 'metadata')
    public readonly dataSourceRepository: Repository<DataSourceEntity>,
    @InjectDataSource('metadata')
    private readonly metadataDataSource: DataSource,

    public readonly tokenService: TokenService,

    private readonly environmentService: EnvironmentService,
    public readonly workspaceDataSourceService: WorkspaceDataSourceService,
  ) {}

  async getWorkspaceIdFromToken(apiToken: string) {
    const validatedToken = await this.tokenService.validateTokenString(apiToken);
    return validatedToken.workspace.id;
  }
  async getWorkspaceApiKey(workspaceId: string, keyName: string): Promise<string | null> {
    try {
      return this.getSpecificWorkspaceKey(workspaceId, keyName);
    } catch (error) {
      console.log(`Error fetching ${keyName} for workspace ${workspaceId}:`, error);
      return null;
    }
  }

  async initializeLLMClients(workspaceId: string) {
    console.log("LLM Client Initialised")
    console.log("Workspace openaikey API key:", await this.getWorkspaceApiKey(workspaceId, 'openaikey'));
    console.log("Workspace anthropicKey API key:", await this.getWorkspaceApiKey(workspaceId, 'anthropicKey'));
    
    const openAIKey = await this.getWorkspaceApiKey(workspaceId, 'openaikey') || process.env.OPENAI_API_KEY;
    const anthropicKey = await this.getWorkspaceApiKey(workspaceId, 'anthropicKey') || process.env.ANTHROPIC_API_KEY;
  
    return {
      openAIclient: new OpenAI({ apiKey: openAIKey }),
      anthropic: new Anthropic({ apiKey: anthropicKey })
    };
  }

  async executeQueryAcrossWorkspaces<T>(
    queryCallback: (workspaceId: string, dataSourceSchema: string, transactionManager?: EntityManager) => Promise<T>
  ): Promise<T[]> {
    const queryRunner = this.metadataDataSource.createQueryRunner();
    await queryRunner.connect();
    
    const results: T[] = [];
    
    try {
      await queryRunner.startTransaction();
      const transactionManager = queryRunner.manager;
  
      const workspaceIds = await this.getWorkspaces();
      const dataSources = await this.dataSourceRepository.find({
        where: {
          workspaceId: In(workspaceIds),
        },
      });
      
      const workspaceIdsWithDataSources = new Set(
        dataSources.map((dataSource) => dataSource.workspaceId),
      );
  
      for (const workspaceId of workspaceIdsWithDataSources) {
        const dataSourceSchema = this.workspaceDataSourceService.getSchemaName(workspaceId);
        
        // Check if table exists before querying
        const tableExists = await this.checkIfTableExists(dataSourceSchema, "_videoInterview");
        
        if (!tableExists) {
          console.log(`Table _videoInterview doesn't exist in schema ${dataSourceSchema}`);
          continue;
        }
        else{
          console.log(`Table _videoInterview exists in schema ${dataSourceSchema}`);
        }
        
        try {
          const result = await queryCallback(workspaceId, dataSourceSchema, transactionManager);
          if (result) {
            results.push(result);
          }
        } catch (error) {
          console.log("Going to throw an error");
          console.error(`Error processing workspace ${workspaceId}:`, error);
        }
      }
  
      await queryRunner.commitTransaction();
      return results;
    } catch (error) {
      console.error("Error executing query across workspaces:", error);
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
    return [];
  }
  
  // Helper function to check if table exists
  private async checkIfTableExists(schema: string, tableName: string): Promise<boolean> {
    const query = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = $1
        AND table_name = $2
      );
    `;

    const result = await this.metadataDataSource.query(query, [schema, tableName]);
    return result[0].exists;
  }

  async executeRawQuery(query: string, params: any[], workspaceId: string, transactionManager?: EntityManager) {
    return this.workspaceDataSourceService.executeRawQuery(query, params, workspaceId, transactionManager);
  }

 async getWorkspaces(): Promise<string[]> {
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
    // console.log("This is the workspace Id:", workspaceId)
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
      facebook_whatsapp_asset_id?: string;
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