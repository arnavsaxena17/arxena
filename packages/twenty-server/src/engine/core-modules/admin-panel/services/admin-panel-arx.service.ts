import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';

import { assertIsDefinedOrThrow } from 'twenty-shared/utils';
import { DataSource, IsNull, type Repository } from 'typeorm';

import { AdminPanelWorkspaceMemberRecruiterProfile } from 'src/engine/core-modules/admin-panel/dtos/admin-panel-workspace-member-recruiter-profile.output';
import { AdminPanelWorkspaceMemberRow } from 'src/engine/core-modules/admin-panel/dtos/admin-panel-workspace-member-row.output';
import { AdminConnectMemberLinkedinUnipileOutput } from 'src/engine/core-modules/admin-panel/dtos/admin-connect-member-linkedin-unipile.output';
import { AdminValidateMemberLinkedinStoredCookiesOutput } from 'src/engine/core-modules/admin-panel/dtos/admin-validate-member-linkedin-stored-cookies.output';
import { LinkedinStoredCookieValidationService } from 'src/engine/core-modules/arx-chat/services/linkedin-stored-cookie-validation.service';
import {
  AuthException,
  AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';
import { AccessTokenService } from 'src/engine/core-modules/auth/token/services/access-token.service';
import { AuthProviderEnum } from 'src/engine/core-modules/workspace/types/workspace.type';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { getWorkspaceSchemaName } from 'src/engine/workspace-datasource/utils/get-workspace-schema-name.util';

const pickStringFromRow = (
  row: Record<string, unknown>,
  key: string,
): string | null => {
  const value = row[key];

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  return String(value);
};

const pickBooleanFromRow = (
  row: Record<string, unknown>,
  key: string,
): boolean | null => {
  const value = row[key];

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  return null;
};

const hasNonEmptyStringRowValue = (
  row: Record<string, unknown>,
  key: string,
): boolean => {
  const value = pickStringFromRow(row, key);

  return Boolean(value?.trim());
};

const emptyRecruiterProfile = (
  workspaceMemberId: string,
): AdminPanelWorkspaceMemberRecruiterProfile => ({
  workspaceMemberId,
  profileId: null,
  phoneNumber: null,
  linkedinUrl: null,
  linkedinUnipileAccountId: null,
  whatsappUnipileAccountId: null,
  keepLinkedinConnected: null,
  email: null,
  firstName: null,
  lastName: null,
  name: null,
  jobTitle: null,
  companyName: null,
  companyDescription: null,
  typeWorkspaceMember: null,
  chromeExtensionId: null,
  extensionInstalled: false,
  linkedinCookiesStored: false,
  linkedinLiAStored: false,
  linkedinCookiesLastSyncedAt: null,
  linkedinCookiesValidatedAt: null,
  linkedinIp: null,
  linkedinCountry: null,
  linkedinUserAgentStored: false,
});

@Injectable()
export class AdminPanelArxService {
  private readonly logger = new Logger(AdminPanelArxService.name);

  constructor(
    private readonly accessTokenService: AccessTokenService,
    private readonly linkedinStoredCookieValidationService: LinkedinStoredCookieValidationService,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectDataSource()
    private readonly coreDataSource: DataSource,
  ) {}

  async listAllWorkspaceMembersForAdminPanel(): Promise<
    AdminPanelWorkspaceMemberRow[]
  > {
    const workspaces = await this.workspaceRepository.find({
      where: { deletedAt: IsNull() },
      relations: ['workspaceUsers', 'workspaceUsers.user'],
      order: { createdAt: 'DESC' },
    });

    const rows: AdminPanelWorkspaceMemberRow[] = [];

    for (const workspace of workspaces) {
      const members =
        workspace.workspaceUsers?.filter(
          (userWorkspace) =>
            !userWorkspace.deletedAt &&
            userWorkspace.user &&
            !userWorkspace.user.deletedAt,
        ) ?? [];

      for (const userWorkspace of members) {
        const recruiterProfile =
          await this.getRecruiterProfileSnapshotForUserInWorkspace(
            workspace.id,
            userWorkspace.userId,
            workspace.databaseSchema,
          );

        rows.push({
          workspaceId: workspace.id,
          workspaceName: workspace.displayName ?? '',
          workspaceSubdomain: workspace.subdomain,
          workspaceCreatedAt: workspace.createdAt,
          userId: userWorkspace.user.id,
          userEmail: userWorkspace.user.email,
          userFirstName: userWorkspace.user.firstName,
          userLastName: userWorkspace.user.lastName,
          userCreatedAt: userWorkspace.user.createdAt,
          membershipCreatedAt: userWorkspace.createdAt,
          recruiterProfile,
        });
      }
    }

    return rows;
  }

  private async checkIfTableExists(
    schema: string,
    tableName: string,
  ): Promise<boolean> {
    if (!schema || !tableName) {
      return false;
    }

    try {
      const result = await this.coreDataSource.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = $1 AND table_name = $2
        )`,
        [schema, tableName],
      );

      return Boolean(result[0]?.exists);
    } catch {
      return false;
    }
  }

  private async resolveWorkspaceMemberProfileTableName(
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

  private mapProfileRowToOutput(
    workspaceMemberId: string,
    row: Record<string, unknown>,
  ): AdminPanelWorkspaceMemberRecruiterProfile {
    return {
      workspaceMemberId,
      profileId: pickStringFromRow(row, 'id'),
      phoneNumber: pickStringFromRow(row, 'phoneNumber'),
      linkedinUrl: pickStringFromRow(row, 'linkedinUrl'),
      linkedinUnipileAccountId: pickStringFromRow(
        row,
        'linkedinUnipileAccountId',
      ),
      whatsappUnipileAccountId: pickStringFromRow(
        row,
        'whatsappUnipileAccountId',
      ),
      keepLinkedinConnected: pickBooleanFromRow(row, 'keepLinkedinConnected'),
      email: pickStringFromRow(row, 'email'),
      firstName: pickStringFromRow(row, 'firstName'),
      lastName: pickStringFromRow(row, 'lastName'),
      name: pickStringFromRow(row, 'name'),
      jobTitle: pickStringFromRow(row, 'jobTitle'),
      companyName: pickStringFromRow(row, 'companyName'),
      companyDescription: pickStringFromRow(row, 'companyDescription'),
      typeWorkspaceMember: pickStringFromRow(row, 'typeWorkspaceMember'),
      chromeExtensionId: pickStringFromRow(row, 'chromeExtensionId'),
      extensionInstalled: hasNonEmptyStringRowValue(row, 'chromeExtensionId'),
      linkedinCookiesStored: hasNonEmptyStringRowValue(row, 'linkedinLiAtToken'),
      linkedinLiAStored: hasNonEmptyStringRowValue(row, 'linkedinLiAToken'),
      linkedinCookiesLastSyncedAt: pickStringFromRow(
        row,
        'linkedinCookiesLastSyncedAt',
      ),
      linkedinCookiesValidatedAt: pickStringFromRow(
        row,
        'linkedinCookiesValidatedAt',
      ),
      linkedinIp: pickStringFromRow(row, 'linkedinIp'),
      linkedinCountry: pickStringFromRow(row, 'linkedinCountry'),
      linkedinUserAgentStored: hasNonEmptyStringRowValue(
        row,
        'linkedinUserAgent',
      ),
    };
  }

  private resolveSchemaName(
    workspaceId: string,
    databaseSchema?: string | null,
  ): string {
    if (databaseSchema && databaseSchema.trim() !== '') {
      return databaseSchema;
    }

    return getWorkspaceSchemaName(workspaceId);
  }

  private async getRecruiterProfileSnapshotForUserInWorkspace(
    workspaceId: string,
    userId: string,
    databaseSchema?: string | null,
  ): Promise<AdminPanelWorkspaceMemberRecruiterProfile | null> {
    const schema = this.resolveSchemaName(workspaceId, databaseSchema);

    try {
      const workspaceMemberRows = await this.coreDataSource.query(
        `SELECT id FROM ${schema}."workspaceMember" WHERE "userId" = $1 LIMIT 1`,
        [userId],
      );

      if (!workspaceMemberRows?.length) {
        return null;
      }

      const workspaceMemberId = String(
        (workspaceMemberRows[0] as { id: string }).id,
      );
      const profileTable =
        await this.resolveWorkspaceMemberProfileTableName(schema);

      if (!profileTable) {
        return emptyRecruiterProfile(workspaceMemberId);
      }

      const profileRows = await this.coreDataSource.query(
        `SELECT * FROM ${schema}."${profileTable}" WHERE "workspaceMemberId" = $1 LIMIT 1`,
        [workspaceMemberId],
      );

      if (!profileRows?.length) {
        return emptyRecruiterProfile(workspaceMemberId);
      }

      return this.mapProfileRowToOutput(
        workspaceMemberId,
        profileRows[0] as Record<string, unknown>,
      );
    } catch (error) {
      this.logger.error(
        'getRecruiterProfileSnapshotForUserInWorkspace failed',
        { workspaceId, userId, error },
      );

      return null;
    }
  }

  async validateMemberLinkedinStoredCookies(
    workspaceId: string,
    workspaceMemberId: string,
  ): Promise<AdminValidateMemberLinkedinStoredCookiesOutput> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId, deletedAt: IsNull() },
    });

    assertIsDefinedOrThrow(
      workspace,
      new AuthException('Workspace not found', AuthExceptionCode.INVALID_INPUT),
    );

    this.logger.log(
      `Validating member linkedin stored cookies for workspace id: ${workspaceId} and workspace member id: ${workspaceMemberId}`,
    );

    const schema = this.resolveSchemaName(
      workspaceId,
      workspace.databaseSchema,
    );
    const memberRows = await this.coreDataSource.query(
      `SELECT id, "userId" FROM ${schema}."workspaceMember" WHERE id = $1 LIMIT 1`,
      [workspaceMemberId],
    );

    if (!memberRows?.length) {
      throw new AuthException(
        'Workspace member not found',
        AuthExceptionCode.INVALID_INPUT,
      );
    }

    const memberRow = memberRows[0] as { id: string; userId: string };
    const userId = String(memberRow.userId);
    const authTokenPair = await this.accessTokenService.generateAccessToken({
      userId,
      workspaceId,
      authProvider: AuthProviderEnum.Password,
    });

    const authContext = await this.accessTokenService.validateToken(
      authTokenPair.token,
    );

    if (authContext.workspaceMemberId !== workspaceMemberId) {
      throw new AuthException(
        'Workspace member mismatch for generated access token',
        AuthExceptionCode.INVALID_INPUT,
      );
    }

    const result =
      await this.linkedinStoredCookieValidationService.validateStoredCookiesForMember(
        {
          workspace,
          workspaceMemberId,
          authToken: authTokenPair.token,
          audience: 'admin',
          forceDisconnectAfterValidation: true,
          logContext: 'admin panel LinkedIn cookie validation',
        },
      );

    return {
      attempted: result.attempted,
      connected: result.connected,
      disconnectedAfterValidation: result.disconnectedAfterValidation,
      keepConnected: result.keepConnected,
      hasLiAt: result.hasLiAt,
      hasLiA: result.hasLiA,
      lastSyncedAt: result.lastSyncedAt,
      lastValidatedAt: result.lastValidatedAt,
      message: result.message,
      errorCode: result.errorCode,
      reconnectAttempted: result.reconnectAttempted,
      reconnectSucceeded: result.reconnectSucceeded,
      accountId: result.accountId,
      accountStatus: result.accountStatus,
    };
  }

  async connectMemberLinkedinUnipile(
    workspaceId: string,
    workspaceMemberId: string,
  ): Promise<AdminConnectMemberLinkedinUnipileOutput> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId, deletedAt: IsNull() },
    });

    assertIsDefinedOrThrow(
      workspace,
      new AuthException('Workspace not found', AuthExceptionCode.INVALID_INPUT),
    );

    this.logger.log(
      `Connecting member LinkedIn Unipile from stored cookies for workspace id: ${workspaceId} and workspace member id: ${workspaceMemberId}`,
    );

    const schema = this.resolveSchemaName(
      workspaceId,
      workspace.databaseSchema,
    );
    const memberRows = await this.coreDataSource.query(
      `SELECT id, "userId" FROM ${schema}."workspaceMember" WHERE id = $1 LIMIT 1`,
      [workspaceMemberId],
    );

    if (!memberRows?.length) {
      throw new AuthException(
        'Workspace member not found',
        AuthExceptionCode.INVALID_INPUT,
      );
    }

    const memberRow = memberRows[0] as { id: string; userId: string };
    const userId = String(memberRow.userId);
    const authTokenPair = await this.accessTokenService.generateAccessToken({
      userId,
      workspaceId,
      authProvider: AuthProviderEnum.Password,
    });

    const authContext = await this.accessTokenService.validateToken(
      authTokenPair.token,
    );

    if (authContext.workspaceMemberId !== workspaceMemberId) {
      throw new AuthException(
        'Workspace member mismatch for generated access token',
        AuthExceptionCode.INVALID_INPUT,
      );
    }

    const result =
      await this.linkedinStoredCookieValidationService.connectStoredCookiesForMember(
        {
          workspace,
          workspaceMemberId,
          authToken: authTokenPair.token,
          audience: 'admin',
          logContext: 'admin panel LinkedIn Unipile connect',
        },
      );

    return {
      attempted: result.attempted,
      connected: result.connected,
      keepConnected: result.keepConnected,
      hasLiAt: result.hasLiAt,
      hasLiA: result.hasLiA,
      lastSyncedAt: result.lastSyncedAt,
      lastValidatedAt: result.lastValidatedAt,
      message: result.message,
      errorCode: result.errorCode,
      reconnectAttempted: result.reconnectAttempted,
      reconnectSucceeded: result.reconnectSucceeded,
      accountId: result.accountId,
      accountStatus: result.accountStatus,
    };
  }
}
