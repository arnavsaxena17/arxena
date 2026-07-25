import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { isOrgChartEnabledEnv } from 'twenty-shared';
import {
  DataSource,
  EntityManager,
  In,
  type ObjectLiteral,
  Repository,
} from 'typeorm';

import { ApiKeyService } from 'src/engine/core-modules/api-key/services/api-key.service';
import { AccessTokenService } from 'src/engine/core-modules/auth/token/services/access-token.service';
import { EmailService } from 'src/engine/core-modules/email/email.service';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { DataSourceEntity } from 'src/engine/metadata-modules/data-source/data-source.entity';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { type WorkspaceRepository } from 'src/engine/twenty-orm/repository/workspace.repository';
import { TwentyORMGlobalManager } from 'src/engine/twenty-orm/twenty-orm-global.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';
import { WebSocketService } from 'src/modules/websocket/websocket.service';
import { StaticGraphQLService } from '../graphql/static-graphql.service';
import { CreateMetaDataStructure } from './object-apis/object-apis-creation';

export type UnipileAccountMappingType = 'LINKEDIN' | 'WHATSAPP';

export type WorkspaceIntegrationKeys = {
  openaikey?: string;
  twilio_account_sid?: string;
  twilio_auth_token?: string;
  linkedin_url?: string;
  whatsapp_key?: string;
  linkedin_unipile_account_id?: string;
  whatsapp_unipile_account_id?: string;
  linkedin_profile_id?: string;
  anthropic_key?: string;
  facebook_whatsapp_api_token?: string;
  facebook_whatsapp_phone_number_id?: string;
  whatsapp_web_phone_number?: string;
  facebook_whatsapp_app_id?: string;
  facebook_whatsapp_asset_id?: string;
  is_chrome_extension_installed?: string;
  chrome_extension_id?: string;
  is_org_chart_enabled?: string;
};

const WORKSPACE_KEY_PROPERTY_BY_NAME: Record<
  string,
  keyof WorkspaceEntity
> = {
  openaikey: 'openaikey',
  twilio_account_sid: 'twilioAccountSid',
  twilioAccountSid: 'twilioAccountSid',
  twilio_auth_token: 'twilioAuthToken',
  twilioAuthToken: 'twilioAuthToken',
  linkedin_url: 'linkedinUrl',
  linkedinUrl: 'linkedinUrl',
  whatsapp_key: 'whatsappKey',
  whatsappKey: 'whatsappKey',
  linkedin_unipile_account_id: 'linkedinUnipileAccountId',
  linkedinUnipileAccountId: 'linkedinUnipileAccountId',
  whatsapp_unipile_account_id: 'whatsappUnipileAccountId',
  whatsappUnipileAccountId: 'whatsappUnipileAccountId',
  linkedin_profile_id: 'linkedinProfileId',
  linkedinProfileId: 'linkedinProfileId',
  anthropic_key: 'anthropicKey',
  anthropicKey: 'anthropicKey',
  facebook_whatsapp_api_token: 'facebookWhatsappApiToken',
  facebookWhatsappApiToken: 'facebookWhatsappApiToken',
  facebook_whatsapp_phone_number_id: 'facebookWhatsappPhoneNumberId',
  facebookWhatsappPhoneNumberId: 'facebookWhatsappPhoneNumberId',
  whatsapp_web_phone_number: 'whatsappWebPhoneNumber',
  whatsappWebPhoneNumber: 'whatsappWebPhoneNumber',
  facebook_whatsapp_app_id: 'facebookWhatsappAppId',
  facebookWhatsappAppId: 'facebookWhatsappAppId',
  facebook_whatsapp_asset_id: 'facebookWhatsappAssetId',
  facebookWhatsappAssetId: 'facebookWhatsappAssetId',
  is_chrome_extension_installed: 'isChromeExtensionInstalled',
  isChromeExtensionInstalled: 'isChromeExtensionInstalled',
  chrome_extension_id: 'chromeExtensionId',
  chromeExtensionId: 'chromeExtensionId',
  is_org_chart_enabled: 'isOrgChartEnabled',
  isOrgChartEnabled: 'isOrgChartEnabled',
};

@Injectable()
export class WorkspaceQueryService {
  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectRepository(UserWorkspaceEntity)
    private readonly userWorkspaceRepository: Repository<UserWorkspaceEntity>,
    @InjectRepository(DataSourceEntity)
    public readonly dataSourceRepository: Repository<DataSourceEntity>,
    @InjectDataSource()
    private readonly metadataDataSource: DataSource,
    public readonly apiKeyService: ApiKeyService,
    public readonly accessTokenService: AccessTokenService,
    public readonly workspaceDataSourceService: WorkspaceDataSourceService,
    public readonly webSocketService: WebSocketService,
    public readonly emailService: EmailService,
    private readonly environmentService: EnvironmentService,
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly twentyORMGlobalManager: TwentyORMGlobalManager,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
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

  async getWorkspaceMemberProfileIdForMember(
    workspaceId: string,
    workspaceMemberId: string,
  ): Promise<string | null> {
    if (!workspaceId || !workspaceMemberId) {
      return null;
    }
    try {
      const profileRepository =
        await this.getObjectRepository<{ id: string; workspaceMemberId: string }>(
          workspaceId,
          'workspaceMemberProfile',
        );
      const profile = await profileRepository.findOne({
        where: { workspaceMemberId },
        select: { id: true },
      });

      return profile?.id ?? null;
    } catch (error) {
      console.error(
        'getWorkspaceMemberProfileIdForMember: query failed',
        workspaceId,
        workspaceMemberId,
        error,
      );

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
      console.log("This isthe validated name workspace:", validatedToken.workspace.displayName)
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
    return getWorkspaceSchemaName(workspaceId);
  }

  async getObjectRepository<T extends ObjectLiteral>(
    workspaceId: string,
    objectNameSingular: string,
  ): Promise<WorkspaceRepository<T>> {
    return this.twentyORMGlobalManager.getRepositoryForWorkspace<T>(
      workspaceId,
      objectNameSingular,
      { shouldBypassPermissionChecks: true },
    );
  }

  // Workspace-schema SQL for system/jobs when repository APIs are awkward (joins, DDL, bulk).
  async executeWorkspaceRawQuery<T = unknown>(
    query: string,
    parameters: unknown[] = [],
    workspaceId?: string,
  ): Promise<T> {
    if (!query || !workspaceId) {
      throw new Error(
        `Invalid parameters: query=${query}, workspaceId=${workspaceId}`,
      );
    }

    const authContext = buildSystemAuthContext(workspaceId);

    return this.globalWorkspaceOrmManager.executeInWorkspaceContext(
      async () => {
        const dataSource =
          await this.globalWorkspaceOrmManager.getGlobalWorkspaceDataSource();

        return dataSource.query(query, parameters, undefined, {
          shouldBypassPermissionChecks: true,
        }) as Promise<T>;
      },
      authContext,
    );
  }

  /**
   * Physical table for workspaceMemberProfile: Twenty uses `_workspaceMemberProfile` in tenant schemas;
   * some paths historically used `workspaceMemberProfile` without the prefix.
   */
  async resolveWorkspaceMemberProfileTableName(
    schema: string,
  ): Promise<'_workspaceMemberProfile' | 'workspaceMemberProfile' | null> {
    if (await this.checkIfTableExists(schema, '_workspaceMemberProfile')) {
      return '_workspaceMemberProfile';
    }
    if (await this.checkIfTableExists(schema, 'workspaceMemberProfile')) {
      return 'workspaceMemberProfile';
    }

    return null;
  }

  /**
   * Indexed mapping (metadata.unipile_accounts), maintained when a member links Unipile in profile.
   */
  private async findWorkspaceIdFromUnipileMetadataMapping(
    accountId: string,
    accountType: UnipileAccountMappingType,
  ): Promise<string | null> {
    try {
      const rows = await this.metadataDataSource.query(
        `SELECT workspace_id FROM metadata.unipile_accounts
         WHERE account_id = $1 AND account_type = $2
         LIMIT 1`,
        [accountId, accountType],
      );

      return rows?.[0]?.workspace_id ?? null;
    } catch (error) {
      console.error(
        'findWorkspaceIdFromUnipileMetadataMapping: query failed',
        accountId,
        accountType,
        error,
      );

      return null;
    }
  }

  /**
   * Fallback: scan each tenant schema's workspaceMemberProfile for the Unipile account column.
   */
  private async findWorkspaceIdFromTenantMemberProfilesByUnipileColumn(
    accountId: string,
    columnName: 'whatsappUnipileAccountId' | 'linkedinUnipileAccountId',
  ): Promise<string | null> {
    const workspaceIds = await this.getWorkspaces();
    if (workspaceIds.length === 0) {
      return null;
    }

    const dataSources = await this.dataSourceRepository.find({
      where: {
        workspaceId: In(workspaceIds),
      },
    });
    const workspaceIdsWithDataSources = new Set(
      dataSources.map((ds) => ds.workspaceId),
    );

    for (const workspaceId of workspaceIds) {
      if (!workspaceIdsWithDataSources.has(workspaceId)) {
        continue;
      }

      const schema = this.getDataSourceSchema(workspaceId);
      const profileTable = await this.resolveWorkspaceMemberProfileTableName(
        schema,
      );

      if (!profileTable) {
        continue;
      }

      const columnExists = await this.checkIfColumnExists(
        schema,
        profileTable,
        columnName,
        { silent: true },
      );

      if (!columnExists) {
        continue;
      }

      try {
        const rows = await this.executeWorkspaceRawQuery<
          Array<Record<string, unknown>>
        >(
          `SELECT 1 FROM ${schema}."${profileTable}" WHERE "${columnName}" = $1 LIMIT 1`,
          [accountId],
          workspaceId,
        );

        if (rows?.length) {
          return workspaceId;
        }
      } catch (error) {
        console.error(
          `findWorkspaceIdFromTenantMemberProfilesByUnipileColumn: workspace ${workspaceId}`,
          error,
        );
      }
    }

    return null;
  }

  async upsertUnipileMemberAccountMapping(
    workspaceMemberId: string,
    workspaceId: string,
    accountId: string,
    accountType: UnipileAccountMappingType,
  ): Promise<void> {
    await this.metadataDataSource.query(
      `INSERT INTO metadata.unipile_accounts
        (workspace_member_id, workspace_id, account_id, account_type, last_active)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (workspace_member_id, account_type)
       DO UPDATE SET
         account_id = EXCLUDED.account_id,
         workspace_id = EXCLUDED.workspace_id,
         last_active = NOW()`,
      [workspaceMemberId, workspaceId, accountId, accountType],
    );
  }

  async deleteUnipileMemberAccountMapping(
    workspaceMemberId: string,
    accountType: UnipileAccountMappingType,
  ): Promise<void> {
    await this.metadataDataSource.query(
      `DELETE FROM metadata.unipile_accounts
       WHERE workspace_member_id = $1 AND account_type = $2`,
      [workspaceMemberId, accountType],
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
      const fromMapping = await this.findWorkspaceIdFromUnipileMetadataMapping(
        accountId,
        'WHATSAPP',
      );

      if (fromMapping) {
        return fromMapping;
      }

      return await this.findWorkspaceIdFromTenantMemberProfilesByUnipileColumn(
        accountId,
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
      const fromMapping = await this.findWorkspaceIdFromUnipileMetadataMapping(
        accountId,
        'LINKEDIN',
      );

      if (fromMapping) {
        return fromMapping;
      }

      return await this.findWorkspaceIdFromTenantMemberProfilesByUnipileColumn(
        accountId,
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
        const dataSourceSchema = this.getDataSourceSchema(workspaceId);
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
    options?: { silent?: boolean },
  ): Promise<boolean> {
    const silent = options?.silent === true;

    try {
      if (!silent) {
        console.log(
          `checkIfColumnExists: Checking if column ${columnName} exists in table ${tableName} in schema ${schema}`,
        );
      }

      if (!schema || !tableName || !columnName) {
        console.error('checkIfColumnExists: Invalid parameters:', {
          schema,
          tableName,
          columnName,
        });
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
      if (!silent) {
        console.log(
          `checkIfColumnExists: Column ${columnName} exists in table ${tableName} in schema ${schema}: ${exists}`,
        );
      }

      return Boolean(exists);
    } catch (error) {
      console.error(
        `checkIfColumnExists: Error checking if column ${columnName} exists in table ${tableName} in schema ${schema}:`,
        error,
      );
      return false;
    }
  }

  async executeRawQuery(
    query: string,
    params: unknown[] = [],
    workspaceId: string,
    _transactionManager?: EntityManager,
  ) {
    try {
      return await this.executeWorkspaceRawQuery(query, params, workspaceId);
    } catch (error) {
      console.error(
        `executeRawQuery: Error executing query for workspace ${workspaceId}:`,
        error,
      );
      throw new Error(
        `Failed to execute raw query for workspace ${workspaceId}: ${error instanceof Error ? error.message : String(error)}`,
      );
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

  async getApiKeys(workspaceId: string, _dataSourceSchema?: string) {
    try {
      return await this.apiKeyService.findActiveByWorkspaceId(workspaceId);
    } catch (error) {
      console.log(
        'Error in getApiKeys for workspace ID',
        workspaceId,
        'Error:',
        error,
      );

      return [];
    }
  }

  async getWorkspaceKeys(
    workspaceId: string,
  ): Promise<WorkspaceIntegrationKeys> {
    try {
      const workspace = await this.workspaceRepository.findOne({
        where: { id: workspaceId },
        select: {
          id: true,
          openaikey: true,
          twilioAccountSid: true,
          twilioAuthToken: true,
          linkedinUrl: true,
          whatsappKey: true,
          linkedinUnipileAccountId: true,
          whatsappUnipileAccountId: true,
          linkedinProfileId: true,
          anthropicKey: true,
          facebookWhatsappApiToken: true,
          facebookWhatsappPhoneNumberId: true,
          whatsappWebPhoneNumber: true,
          facebookWhatsappAppId: true,
          facebookWhatsappAssetId: true,
          isChromeExtensionInstalled: true,
          chromeExtensionId: true,
          isOrgChartEnabled: true,
        },
      });

      if (!workspace) {
        return {};
      }

      const rawIsOrgChartEnabled = workspace.isOrgChartEnabled;
      const isOrgChartEnabledNormalized =
        rawIsOrgChartEnabled != null &&
        String(rawIsOrgChartEnabled).trim() !== ''
          ? String(rawIsOrgChartEnabled).trim()
          : isOrgChartEnabledEnv
            ? 'true'
            : 'false';

      return {
        openaikey: workspace.openaikey ?? undefined,
        twilio_account_sid: workspace.twilioAccountSid ?? undefined,
        twilio_auth_token: workspace.twilioAuthToken ?? undefined,
        linkedin_url: workspace.linkedinUrl ?? undefined,
        whatsapp_key: workspace.whatsappKey ?? undefined,
        linkedin_unipile_account_id:
          workspace.linkedinUnipileAccountId ?? undefined,
        whatsapp_unipile_account_id:
          workspace.whatsappUnipileAccountId ?? undefined,
        linkedin_profile_id: workspace.linkedinProfileId ?? undefined,
        anthropic_key: workspace.anthropicKey ?? undefined,
        facebook_whatsapp_api_token:
          workspace.facebookWhatsappApiToken ?? undefined,
        facebook_whatsapp_phone_number_id:
          workspace.facebookWhatsappPhoneNumberId ?? undefined,
        whatsapp_web_phone_number:
          workspace.whatsappWebPhoneNumber ?? undefined,
        facebook_whatsapp_app_id: workspace.facebookWhatsappAppId ?? undefined,
        facebook_whatsapp_asset_id:
          workspace.facebookWhatsappAssetId ?? undefined,
        is_chrome_extension_installed:
          workspace.isChromeExtensionInstalled ?? undefined,
        chrome_extension_id: workspace.chromeExtensionId ?? undefined,
        is_org_chart_enabled: isOrgChartEnabledNormalized,
      };
    } catch (error) {
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
      const propertyName = WORKSPACE_KEY_PROPERTY_BY_NAME[keyName];

      if (!propertyName) {
        return null;
      }

      const workspace = await this.workspaceRepository.findOne({
        where: { id: workspaceId },
        select: { id: true, [propertyName]: true },
      });

      if (!workspace) {
        return null;
      }

      const value = workspace[propertyName];

      return typeof value === 'string' ? value : value == null ? null : String(value);
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
    keys: WorkspaceIntegrationKeys,
  ): Promise<boolean> {
    try {
      console.log('Going to try and update workspace api keys::', keys);

      const sanitizedKeys = Object.fromEntries(
        Object.entries(keys).filter(([key]) => key !== 'linkedin_cookie_auth'),
      );

      const updatePayload: Partial<WorkspaceEntity> = {};

      for (const [key, value] of Object.entries(sanitizedKeys)) {
        if (value === undefined) {
          continue;
        }

        const propertyName = WORKSPACE_KEY_PROPERTY_BY_NAME[key];

        if (!propertyName) {
          continue;
        }

        (updatePayload as Record<string, string | null>)[propertyName] = value;
      }

      if (Object.keys(updatePayload).length === 0) {
        return true;
      }

      await this.workspaceRepository.update(workspaceId, updatePayload);

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
      const userWorkspace = await this.userWorkspaceRepository.findOne({
        where: { workspaceId },
        select: { userId: true },
      });

      return userWorkspace?.userId ?? null;
    } catch (error) {
      console.error(
        `Error fetching userId for workspace ${workspaceId}:`,
        error,
      );
      return null;
    }
  }

  async createMetadataStructure(token: string, origin: string): Promise<void> {
    await new CreateMetaDataStructure(
      this,
      this.staticGraphQLService,
      this.environmentService,
      this.webSocketService,
    ).createMetadataStructure(token, origin);
  }
}
