import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { DataSource, EntityManager, In, Repository } from 'typeorm';

import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
// import { EnvironmentService } from 'src/engine/integrations/environment/environment.service';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';
// import { TokenService } from 'src/engine/core-modules/auth/services/token.service';
import { AccessTokenService } from 'src/engine/core-modules/auth/token/services/access-token.service';
// import { WorkspaceQueryService } from '../workspace-query.service';
import { ApiKeyService } from 'src/engine/core-modules/auth/services/api-key.service';
import { EmailService } from 'src/engine/core-modules/email/email.service';
import { JwtWrapperService } from 'src/engine/core-modules/jwt/services/jwt-wrapper.service';
import { WebSocketService } from 'src/modules/websocket/websocket.service';
import { StaticGraphQLService } from '../graphql/static-graphql.service';
import { CreateMetaDataStructure } from './object-apis/object-apis-creation';

type UnipileMemberMappingAccountType = 'WHATSAPP' | 'LINKEDIN';

const WORKSPACE_MEMBER_PROFILE_TABLE_CANDIDATES = [
  '_workspaceMemberProfile',
  'workspaceMemberProfile',
] as const;

@Injectable()
export class WorkspaceQueryService {
  constructor(
    @InjectRepository(Workspace, 'core')
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(DataSourceEntity, 'metadata')
    public readonly dataSourceRepository: Repository<DataSourceEntity>,
    @InjectDataSource('metadata')
    private readonly metadataDataSource: DataSource,
    public readonly apiKeyService: ApiKeyService,
    public readonly accessTokenService: AccessTokenService,
    public readonly workspaceDataSourceService: WorkspaceDataSourceService,
    public readonly webSocketService: WebSocketService,

    
    public readonly emailService: EmailService,
    private readonly jwtWrapperService: JwtWrapperService,
    private readonly staticGraphQLService: StaticGraphQLService,
  ) {}


  async getWorkspaceIdFromToken(apiToken: string) {
    if (!apiToken) {
      throw new Error('API token is required');
    }
    try {
      const validatedToken =
        await this.accessTokenService.validateToken(apiToken);

      return validatedToken.workspace.id;
    } catch (error) {
      console.error('Error getting workspace ID from token:', error);
      throw new Error(`Failed to get workspace ID from token: ${error.message}`);
    }
  }

  async getWorkspaceMemberIdFromToken(apiToken: string): Promise<string | null> {
    if (!apiToken) {
      return null;
    }
    try {
      const validatedToken =
        await this.accessTokenService.validateToken(apiToken);
      return validatedToken.workspaceMemberId ?? null;
    } catch {
      return null;
    }
  }
  async getWorkspaceNameFromToken(apiToken: string) {
    if (!apiToken) {
      throw new Error('API token is required');
    }
    try {
      const validatedToken =
      await this.accessTokenService.validateToken(apiToken);
      console.log("This isthe validated name workspace:", validatedToken.workspace)
      return validatedToken.workspace.displayName;
    } catch (error) {
      console.error('Error getting workspace name from token:', error);
      throw new Error(`Failed to get workspace name from token: ${error.message}`);
    }
  }

  async getWorkspaceApiKey(
    workspaceId: string,
    keyName: string,
  ): Promise<string | null> {
    try {
      return this.getSpecificWorkspaceKey(workspaceId, keyName);
    } catch (error) {
      console.log(
        `Error fetching ${keyName} for workspace ${workspaceId}:`,
        error,
      );
      return null;
    }
  }


  async initializeLLMClients(workspaceId: string) {

    const openAIKey =
      (await this.getWorkspaceApiKey(workspaceId, 'openaikey')) ||
      '';
    const anthropicKey =
      (await this.getWorkspaceApiKey(workspaceId, 'anthropicKey')) ||
      '';

    return {
      openAIclient: new OpenAI({ apiKey: openAIKey }),
      anthropic: new Anthropic({ apiKey: anthropicKey }),
    };
  }

  getDataSourceSchema(workspaceId: string) {
    return this.workspaceDataSourceService.getSchemaName(workspaceId);
  }

  /**
   * Idempotent: speeds up webhook resolution (account_id → workspace).
   * Migration 1740800000000 also creates this index for deploy-time consistency.
   */
  private async ensureUnipileAccountsWebhookLookupIndex(): Promise<void> {
    await this.metadataDataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_unipile_accounts_account_id_type
      ON metadata.unipile_accounts (account_id, account_type)
    `);
  }

  /**
   * metadata.unipile_accounts: one row per (workspace_member_id, account_type), keyed by Unipile account_id.
   */
  async upsertUnipileMemberAccountMapping(
    workspaceMemberId: string,
    workspaceId: string,
    accountId: string,
    accountType: UnipileMemberMappingAccountType,
  ): Promise<void> {
    await this.ensureUnipileAccountsWebhookLookupIndex();
    await this.metadataDataSource.query(
      `INSERT INTO metadata.unipile_accounts
       (workspace_member_id, workspace_id, account_id, account_type, status, last_active, created_at)
       VALUES ($1, $2, $3, $4, 'OK', NOW(), NOW())
       ON CONFLICT (workspace_member_id, account_type)
       DO UPDATE SET account_id = $3, workspace_id = $2, last_active = NOW(), status = 'OK'`,
      [workspaceMemberId, workspaceId, accountId, accountType],
    );
  }

  async deleteUnipileMemberAccountMapping(
    workspaceMemberId: string,
    accountType: UnipileMemberMappingAccountType,
  ): Promise<void> {
    await this.metadataDataSource.query(
      `DELETE FROM metadata.unipile_accounts WHERE workspace_member_id = $1 AND account_type = $2`,
      [workspaceMemberId, accountType],
    );
  }

  /**
   * All Unipile account ids linked to members of this workspace (for filtering Unipile API lists).
   */
  async getUnipileAccountIdsForWorkspace(
    workspaceId: string,
    accountType: UnipileMemberMappingAccountType,
  ): Promise<string[]> {
    await this.ensureUnipileAccountsWebhookLookupIndex();
    const rows = await this.metadataDataSource.query(
      `SELECT account_id FROM metadata.unipile_accounts
       WHERE workspace_id = $1 AND account_type = $2 AND account_id IS NOT NULL AND TRIM(account_id) <> ''`,
      [workspaceId, accountType],
    );
    if (!Array.isArray(rows)) {
      return [];
    }

    return rows
      .map((row: { account_id: string }) => String(row.account_id ?? '').trim())
      .filter(Boolean);
  }

  /**
   * One-off / maintenance: copy linkedinUnipileAccountId / whatsappUnipileAccountId from tenant
   * workspaceMemberProfile into metadata.unipile_accounts for webhook and API filtering.
   */
  async backfillUnipileMemberAccountMappingsFromTenantProfiles(): Promise<{
    workspacesScanned: number;
    mappingsWritten: number;
  }> {
    await this.ensureUnipileAccountsWebhookLookupIndex();
    let workspacesScanned = 0;
    let mappingsWritten = 0;

    const workspaceIds = await this.getWorkspaces();
    const dataSources = await this.dataSourceRepository.find({
      where: { workspaceId: In(workspaceIds) },
    });
    const workspaceIdsWithDataSources = new Set(
      dataSources.map((dataSource) => dataSource.workspaceId),
    );

    for (const workspaceId of workspaceIdsWithDataSources) {
      workspacesScanned++;
      const schema = this.getDataSourceSchema(workspaceId);

      for (const tableName of WORKSPACE_MEMBER_PROFILE_TABLE_CANDIDATES) {
        const tableExists = await this.checkIfTableExists(schema, tableName);
        if (!tableExists) {
          continue;
        }

        type ProfileRow = {
          workspaceMemberId: string;
          linkedinUnipileAccountId: string | null;
          whatsappUnipileAccountId: string | null;
        };

        let rows: ProfileRow[];
        try {
          rows = await this.executeRawQuery(
            `SELECT "workspaceMemberId", "linkedinUnipileAccountId", "whatsappUnipileAccountId"
             FROM ${schema}."${tableName}"
             WHERE ("linkedinUnipileAccountId" IS NOT NULL AND TRIM("linkedinUnipileAccountId") <> '')
                OR ("whatsappUnipileAccountId" IS NOT NULL AND TRIM("whatsappUnipileAccountId") <> '')`,
            [],
            workspaceId,
          );
        } catch {
          continue;
        }

        if (!Array.isArray(rows)) {
          continue;
        }

        for (const row of rows) {
          const memberId = row.workspaceMemberId;
          if (!memberId) {
            continue;
          }
          const li = row.linkedinUnipileAccountId?.trim();
          const wa = row.whatsappUnipileAccountId?.trim();
          if (li) {
            await this.upsertUnipileMemberAccountMapping(
              memberId,
              workspaceId,
              li,
              'LINKEDIN',
            );
            mappingsWritten++;
          }
          if (wa) {
            await this.upsertUnipileMemberAccountMapping(
              memberId,
              workspaceId,
              wa,
              'WHATSAPP',
            );
            mappingsWritten++;
          }
        }

        break;
      }
    }

    return { workspacesScanned, mappingsWritten };
  }

  private async findWorkspaceIdFromUnipileMemberAccountMapping(
    accountId: string,
    accountType: UnipileMemberMappingAccountType,
  ): Promise<string | null> {
    await this.ensureUnipileAccountsWebhookLookupIndex();
    const result = await this.metadataDataSource.query(
      `SELECT workspace_id FROM metadata.unipile_accounts
       WHERE account_id = $1 AND account_type = $2 LIMIT 1`,
      [accountId, accountType],
    );
    const workspaceId = result?.[0]?.workspace_id;

    return workspaceId ? String(workspaceId) : null;
  }

  /**
   * Fallback when metadata.unipile_accounts is empty or stale: scan each tenant schema's workspaceMemberProfile.
   */
  private async findWorkspaceIdByScanningWorkspaceMemberProfiles(
    accountId: string,
    profileColumn: 'whatsappUnipileAccountId' | 'linkedinUnipileAccountId',
  ): Promise<string | null> {
    const workspaceIds = await this.getWorkspaces();
    const dataSources = await this.dataSourceRepository.find({
      where: { workspaceId: In(workspaceIds) },
    });
    const workspaceIdsWithDataSources = new Set(
      dataSources.map((dataSource) => dataSource.workspaceId),
    );

    for (const workspaceId of workspaceIdsWithDataSources) {
      const schema = this.getDataSourceSchema(workspaceId);
      for (const tableName of WORKSPACE_MEMBER_PROFILE_TABLE_CANDIDATES) {
        const tableExists = await this.checkIfTableExists(schema, tableName);
        if (!tableExists) {
          continue;
        }
        try {
          const rows = await this.executeRawQuery(
            `SELECT 1 FROM ${schema}."${tableName}" WHERE "${profileColumn}" = $1 LIMIT 1`,
            [accountId],
            workspaceId,
          );
          if (Array.isArray(rows) && rows.length > 0) {
            return workspaceId;
          }
        } catch {
          // Column or table mismatch for this workspace; try next candidate.
        }
      }
    }

    return null;
  }

  private async findWorkspaceIdByUnipileAccountId(
    accountId: string,
    mappingType: UnipileMemberMappingAccountType,
    profileColumn: 'whatsappUnipileAccountId' | 'linkedinUnipileAccountId',
  ): Promise<string | null> {
    const fromMapping =
      await this.findWorkspaceIdFromUnipileMemberAccountMapping(
        accountId,
        mappingType,
      );
    if (fromMapping) {
      return fromMapping;
    }

    return this.findWorkspaceIdByScanningWorkspaceMemberProfiles(
      accountId,
      profileColumn,
    );
  }

  async findWorkspaceIdByWhatsappUnipileAccountId(
    accountId: string,
  ): Promise<string | null> {
    if (!accountId) {
      console.log(
        'findWorkspaceIdByWhatsappUnipileAccountId: accountId is empty, skipping lookup',
      );
      return null;
    }

    try {
      return await this.findWorkspaceIdByUnipileAccountId(
        accountId,
        'WHATSAPP',
        'whatsappUnipileAccountId',
      );
    } catch (error) {
      console.error(
        'findWorkspaceIdByWhatsappUnipileAccountId: Failed to lookup workspace for account id',
        accountId,
        'Error:',
        error,
      );

      return null;
    }
  }

  async findWorkspaceIdByLinkedinUnipileAccountId(
    accountId: string,
  ): Promise<string | null> {
    if (!accountId) {
      console.log(
        'findWorkspaceIdByLinkedinUnipileAccountId: accountId is empty, skipping lookup',
      );

      return null;
    }

    try {
      return await this.findWorkspaceIdByUnipileAccountId(
        accountId,
        'LINKEDIN',
        'linkedinUnipileAccountId',
      );
    } catch (error) {
      console.error(
        'findWorkspaceIdByLinkedinUnipileAccountId: Failed to lookup workspace for account id',
        accountId,
        'Error:',
        error,
      );

      return null;
    }
  }

  async executeQueryAcrossWorkspaces<T>(
    queryCallback: (
      workspaceId: string,
      dataSourceSchema: string,
      transactionManager?: EntityManager,
    ) => Promise<T>,
    options: { stopOnFirstResult?: boolean } = { stopOnFirstResult: true },
  ): Promise<T[]> {
    const queryRunner = this.metadataDataSource.createQueryRunner();
    await queryRunner.connect();
    const results: T[] = [];
    const connectedWorkspaces = new Set<string>();
    const stopOnFirstResult = options.stopOnFirstResult ?? true;

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
        const dataSourceSchema =
          this.workspaceDataSourceService.getSchemaName(workspaceId);
        const tableExists = await this.checkIfTableExists(
          dataSourceSchema,
          '_videoInterview',
        );
        if (!tableExists) {
          console.log(
            `Table _videoInterview doesn't exist in schema ${dataSourceSchema}`,
          );
          continue;
        }
        try {
          await this.workspaceDataSourceService.connectToWorkspaceDataSource(
            workspaceId,
          );
          connectedWorkspaces.add(workspaceId);

          const result = await queryCallback(
            workspaceId,
            dataSourceSchema,
            transactionManager,
          );
          if (result) {
            results.push(result);
            if (stopOnFirstResult) {
              await queryRunner.commitTransaction();
              return results;
            }
          }
        } catch (error) {
          console.log('Going to throw an error');
          console.error(`Error processing workspace ${workspaceId}:`, error);
        }
      }

      await queryRunner.commitTransaction();
      return results;
    } catch (error) {
      console.error('Error executing query across workspaces:', error);
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
    } finally {
      try {
        if (!queryRunner.isReleased) {
          await queryRunner.release();
        }
      } catch (releaseError) {
        console.error('Error releasing query runner:', releaseError);
      }
      await Promise.all(
        Array.from(connectedWorkspaces).map((workspaceId) =>
          this.workspaceDataSourceService.releaseWorkspaceDataSource(
            workspaceId,
          ).catch((error) =>
            console.error(
              `Error releasing workspace data source for workspace ${workspaceId}:`,
              error,
            ),
          ),
        ),
      );
    }

    return [];
  }

  // Helper function to check if table exists
  async checkIfTableExists(
    schema: string,
    tableName: string,
  ): Promise<boolean> {
    try {
      
      if (!schema || !tableName) {
        console.error('checkIfTableExists: Invalid parameters:', { schema, tableName });
        return false;
      }
      
      const query = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1
          AND table_name = $2
        );
      `;

      const result = await this.metadataDataSource.query(query, [
        schema,
        tableName,
      ]);

      const exists = result[0]?.exists;
      return Boolean(exists);
    } catch (error) {
      console.error(`checkIfTableExists: Error checking if table ${tableName} exists in schema ${schema}:`, error);
      return false;
    }
  }

  // Helper function to check if column exists in table
  async checkIfColumnExists(
    schema: string,
    tableName: string,
    columnName: string,
  ): Promise<boolean> {
    try {
      console.log(`checkIfColumnExists: Checking if column ${columnName} exists in table ${tableName} in schema ${schema}`);
      
      if (!schema || !tableName || !columnName) {
        console.error('checkIfColumnExists: Invalid parameters:', { schema, tableName, columnName });
        return false;
      }
      
      const query = `
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = $1
          AND table_name = $2
          AND column_name = $3
        );
      `;

      const result = await this.metadataDataSource.query(query, [
        schema,
        tableName,
        columnName,
      ]);

      const exists = result[0]?.exists;
      console.log(`checkIfColumnExists: Column ${columnName} exists in table ${tableName} in schema ${schema}: ${exists}`);
      
      return Boolean(exists);
    } catch (error) {
      console.error(`checkIfColumnExists: Error checking if column ${columnName} exists in table ${tableName} in schema ${schema}:`, error);
      return false;
    }
  }

  async executeRawQuery(
    query: string,
    params: any[],
    workspaceId: string,
    transactionManager?: EntityManager,
  ) {
    try {
      
      if (!query || !workspaceId) {
        throw new Error(`Invalid parameters: query=${query}, workspaceId=${workspaceId}`);
      }

      const result = await this.workspaceDataSourceService.executeRawQuery(
        query,
        params,
        workspaceId,
        transactionManager,
      );

      return result;
    } catch (error) {
      console.error(`executeRawQuery: Error executing query for workspace ${workspaceId}:`, error);
      throw new Error(`Failed to execute raw query for workspace ${workspaceId}: ${error.message}`);
    }
  }

  async getWorkspaces(): Promise<string[]> {
    const workspaces = await this.workspaceRepository.find({
      select: ['id'],
    });
    const workspaceIds = workspaces.map((workspace) => workspace.id);

    return workspaceIds;
  }

  async getWorkspaceById(workspaceId: string) {
    return this.workspaceRepository.findOne({ where: { id: workspaceId } });
  }

  // Add this method to the service
  async getApiKeys(
    workspaceId: string,
    dataSourceSchema: string,
    transactionManager?: EntityManager,
  ) {
    try {
      // Check if the apiKey table exists
      const tableExists = await this.checkIfTableExists(dataSourceSchema, 'apiKey');
      if (!tableExists) {
        console.log(`getApiKeys: apiKey table does not exist in schema ${dataSourceSchema} for workspace ${workspaceId}`);
        return [];
      }
      
      const apiKeys = await this.workspaceDataSourceService.executeRawQuery(
        `SELECT * FROM ${dataSourceSchema}."apiKey" where "apiKey"."revokedAt" IS NULL ORDER BY "apiKey"."createdAt" ASC`,
        [],
        workspaceId,
        transactionManager,
      );

      if (!apiKeys || !Array.isArray(apiKeys)) {
        console.log(
          `getApiKeys: Invalid result for workspace ${workspaceId}, schema ${dataSourceSchema}. Result:`,
          apiKeys,
        );
        return [];
      }

      return apiKeys;
    } catch (e) {
      console.log(
        'Error in getApiKeys for workspace ID',
        workspaceId,
        'for dataSourceSchema',
        dataSourceSchema,
        'Error:',
        e,
      );

      return [];
    }
  }

  async getWorkspaceKeys(workspaceId: string): Promise<{
    openaikey?: string;
    twilio_account_sid?: string;
    twilio_auth_token?: string;
    linkedin_url?: string;
    whatsapp_key?: string;
    linkedin_unipile_account_id?: string;
    whatsapp_unipile_account_id?: string;
    linkedin_profile_id?: string;
    linkedin_cookie_auth?: string;
    anthropic_key?: string;
    facebook_whatsapp_api_token?: string;
    facebook_whatsapp_phone_number_id?: string;
    whatsapp_web_phone_number?: string;
    facebook_whatsapp_app_id?: string;
    facebook_whatsapp_asset_id?: string;
    is_chrome_extension_installed?: string;
    chrome_extension_id?: string;
    is_org_chart_enabled?: string;
  }> {
    try {
      console.log('Getting workspace api keys for workspace:', workspaceId);
      // First, ensure all necessary columns exist
      const alterTableQuery = `
      ALTER TABLE core.workspace
      ADD COLUMN IF NOT EXISTS openaikey varchar(255),
      ADD COLUMN IF NOT EXISTS twilio_account_sid varchar(255),
      ADD COLUMN IF NOT EXISTS twilio_auth_token varchar(255),
      ADD COLUMN IF NOT EXISTS linkedin_url varchar(255),
      ADD COLUMN IF NOT EXISTS whatsapp_key varchar(255),
      ADD COLUMN IF NOT EXISTS linkedin_unipile_account_id varchar(255),
      ADD COLUMN IF NOT EXISTS whatsapp_unipile_account_id varchar(255),
      ADD COLUMN IF NOT EXISTS linkedin_profile_id varchar(255),
      ADD COLUMN IF NOT EXISTS anthropic_key varchar(255),
      ADD COLUMN IF NOT EXISTS facebook_whatsapp_api_token varchar(255),
      ADD COLUMN IF NOT EXISTS facebook_whatsapp_phone_number_id varchar(255),
      ADD COLUMN IF NOT EXISTS whatsapp_web_phone_number varchar(255),
      ADD COLUMN IF NOT EXISTS facebook_whatsapp_app_id varchar(255),
      ADD COLUMN IF NOT EXISTS facebook_whatsapp_asset_id varchar(255),
      ADD COLUMN IF NOT EXISTS is_chrome_extension_installed varchar(255) DEFAULT 'false',
      ADD COLUMN IF NOT EXISTS chrome_extension_id varchar(255),
      ADD COLUMN IF NOT EXISTS linkedin_cookie_auth TEXT,
      ADD COLUMN IF NOT EXISTS is_org_chart_enabled varchar(255) DEFAULT 'true'
    `;

      await this.executeRawQuery(alterTableQuery, [], workspaceId);
      // Then proceed with the select query
      const selectQuery = `
      SELECT 
        openaikey,
        twilio_account_sid,
        twilio_auth_token,
        linkedin_url,
        whatsapp_key,
        linkedin_unipile_account_id,
        linkedin_cookie_auth,
        whatsapp_unipile_account_id,
        linkedin_profile_id,
        anthropic_key,
        facebook_whatsapp_api_token,
        facebook_whatsapp_phone_number_id,
        whatsapp_web_phone_number,
        facebook_whatsapp_app_id,
        facebook_whatsapp_asset_id,
        is_chrome_extension_installed,
        chrome_extension_id,
        is_org_chart_enabled
      FROM core.workspace 
      WHERE id = $1
    `;

      const result = await this.executeRawQuery(
        selectQuery,
        [workspaceId],
        workspaceId,
      );

      if (result && result[0]) {
        return {
          openaikey: result[0].openaikey,
          twilio_account_sid: result[0].twilio_account_sid,
          twilio_auth_token: result[0].twilio_auth_token,
          linkedin_url: result[0].linkedin_url,
          whatsapp_key: result[0].whatsapp_key,
          linkedin_unipile_account_id: result[0].linkedin_unipile_account_id,
          whatsapp_unipile_account_id: result[0].whatsapp_unipile_account_id,
          linkedin_profile_id: result[0].linkedin_profile_id,
          linkedin_cookie_auth: result[0].linkedin_cookie_auth,
          anthropic_key: result[0].anthropic_key,
          facebook_whatsapp_api_token: result[0].facebook_whatsapp_api_token,
          facebook_whatsapp_phone_number_id: result[0].facebook_whatsapp_phone_number_id,
          whatsapp_web_phone_number: result[0].whatsapp_web_phone_number,
          facebook_whatsapp_app_id: result[0].facebook_whatsapp_app_id,
          facebook_whatsapp_asset_id: result[0].facebook_whatsapp_asset_id,
          is_chrome_extension_installed:
            result[0].is_chrome_extension_installed,
          chrome_extension_id: result[0].chrome_extension_id,
          is_org_chart_enabled: result[0].is_org_chart_enabled,
        };
      }

      return {};
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? '');
      const isNoDataSource =
        message.includes('DataSourceEntity') ||
        message.includes('Could not find any entity');

      if (isNoDataSource) {
        return {};
      }
      console.error(
        `Error fetching API keys for workspace ${workspaceId}:`,
        error,
      );
      throw new Error('Failed to fetch workspace API keys');
    }
  }

  async getSpecificWorkspaceKey(
    workspaceId: string,
    keyName: string,
  ): Promise<string | null> {
    try {
      // Convert camelCase to snake_case for database column names
      const columnName = keyName.replace(
        /[A-Z]/g,
        (letter) => `_${letter.toLowerCase()}`,
      );

      const query = `
        SELECT ${columnName}
        FROM core.workspace 
        WHERE id = $1
      `;

      const result = await this.executeRawQuery(
        query,
        [workspaceId],
        workspaceId,
      );

      if (result && result[0]) {
        return result[0][columnName] || null;
      }

      return null;
    } catch (error) {
      console.error(
        `Error fetching ${keyName} for workspace ${workspaceId}:`,
        error,
      );
      throw new Error(`Failed to fetch ${keyName}`);
    }
  }

  async checkWorkspaceKeyExists(
    workspaceId: string,
    keyName: string,
  ): Promise<boolean> {
    const value = await this.getSpecificWorkspaceKey(workspaceId, keyName);

    return value !== null && value !== undefined && value !== '';
  }

  async updateWorkspaceKeys(
    workspaceId: string,
    keys: {
      openaikey?: string;
      twilio_account_sid?: string;
      twilio_auth_token?: string;
      linkedin_url?: string;
      whatsapp_key?: string;
      linkedin_unipile_account_id?: string;
      whatsapp_unipile_account_id?: string;
      linkedin_profile_id?: string;
      linkedin_cookie_auth?: string;
      anthropic_key?: string;
      facebook_whatsapp_api_token?: string;
      facebook_whatsapp_phone_number_id?: string;
      whatsapp_web_phone_number?: string;
      facebook_whatsapp_app_id?: string;
      facebook_whatsapp_asset_id?: string;
      is_chrome_extension_installed?: string;
      chrome_extension_id?: string;
      is_org_chart_enabled?: string;
    },
  ): Promise<boolean> {
    try {
      console.log('Going to try and update workspace api keys::', keys);
      const updates: string[] = [];
      const params: any[] = [];
      let paramCounter = 1;

      const alterTableQuery = `
      ALTER TABLE core.workspace
      ADD COLUMN IF NOT EXISTS openaikey varchar(255),
      ADD COLUMN IF NOT EXISTS twilio_account_sid varchar(255),
      ADD COLUMN IF NOT EXISTS twilio_auth_token varchar(255),
      ADD COLUMN IF NOT EXISTS linkedin_url varchar(255),
      ADD COLUMN IF NOT EXISTS whatsapp_key varchar(255),
      ADD COLUMN IF NOT EXISTS linkedin_unipile_account_id varchar(255),
      ADD COLUMN IF NOT EXISTS whatsapp_unipile_account_id varchar(255),
      ADD COLUMN IF NOT EXISTS linkedin_profile_id varchar(255),
      ADD COLUMN IF NOT EXISTS anthropic_key varchar(255),
      ADD COLUMN IF NOT EXISTS facebook_whatsapp_api_token varchar(255),
      ADD COLUMN IF NOT EXISTS facebook_whatsapp_phone_number_id varchar(255),
      ADD COLUMN IF NOT EXISTS whatsapp_web_phone_number varchar(255),
      ADD COLUMN IF NOT EXISTS facebook_whatsapp_app_id varchar(255),
      ADD COLUMN IF NOT EXISTS facebook_whatsapp_asset_id varchar(255),
      ADD COLUMN IF NOT EXISTS is_chrome_extension_installed varchar(255) DEFAULT 'false',
      ADD COLUMN IF NOT EXISTS linkedin_cookie_auth TEXT,
      ADD COLUMN IF NOT EXISTS is_org_chart_enabled varchar(255) DEFAULT 'true'
    `;
    
    await this.executeRawQuery(alterTableQuery, [], workspaceId);


      Object.entries(keys).forEach(([key, value]) => {
        if (value !== undefined) {
          const columnName = key.replace(
            /[A-Z]/g,
            (letter) => `_${letter.toLowerCase()}`,
          );

          updates.push(`${columnName} = $${paramCounter}`);
          params.push(value);
          paramCounter++;
        }
      });
      if (updates.length === 0) {
        return true;
      }

      params.push(workspaceId);
      const query = `UPDATE core.workspace
        SET ${updates.join(', ')}
        WHERE id = $${paramCounter}
      `;
      await this.executeRawQuery(query, params, workspaceId);
      
      return true;
    } catch (error) {
      console.error(
        `Error updating API keys for workspace ${workspaceId}:`,
        error,
      );
      throw new Error('Failed to update workspace API keys');
    }
  }

  async getUserIdFromWorkspaceId(workspaceId: string): Promise<string | null> {
    try {
      const query = `
        SELECT "userId"
        FROM core."userWorkspace"
        WHERE "workspaceId" = $1
        LIMIT 1
      `;

      const result = await this.executeRawQuery(query, [workspaceId], workspaceId);
      
      if (result && result[0]) {
        return result[0].userId;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching userId for workspace ${workspaceId}:`, error);
      return null;
    }
  }

  async createMetadataStructure(token: string, origin: string): Promise<void> {
    await new CreateMetaDataStructure(
      this,
      this.staticGraphQLService,
      this.webSocketService
    ).createMetadataStructure(token, origin);
  }
}
