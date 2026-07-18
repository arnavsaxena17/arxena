import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';

import { DataSource, IsNull, Repository } from 'typeorm';

import { AdminPanelWorkspaceMemberRecruiterProfile } from 'src/engine/core-modules/admin-panel/dtos/admin-panel-workspace-member-recruiter-profile.output';
import { AdminPanelWorkspaceMemberRow } from 'src/engine/core-modules/admin-panel/dtos/admin-panel-workspace-member-row.output';
import { AdminConnectMemberLinkedinUnipileOutput } from 'src/engine/core-modules/admin-panel/dtos/admin-connect-member-linkedin-unipile.output';
import { AdminValidateMemberLinkedinStoredCookiesOutput } from 'src/engine/core-modules/admin-panel/dtos/admin-validate-member-linkedin-stored-cookies.output';
import { EnvironmentVariable } from 'src/engine/core-modules/admin-panel/dtos/environment-variable.dto';
import { EnvironmentVariablesGroupData } from 'src/engine/core-modules/admin-panel/dtos/environment-variables-group.dto';
import { EnvironmentVariablesOutput } from 'src/engine/core-modules/admin-panel/dtos/environment-variables.output';
import { UserLookup } from 'src/engine/core-modules/admin-panel/dtos/user-lookup.entity';
import {
  AuthException,
  AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';
import { AccessTokenService } from 'src/engine/core-modules/auth/token/services/access-token.service';
import { LoginTokenService } from 'src/engine/core-modules/auth/token/services/login-token.service';
import { DomainManagerService } from 'src/engine/core-modules/domain-manager/services/domain-manager.service';
import { ENVIRONMENT_VARIABLES_GROUP_METADATA } from 'src/engine/core-modules/environment/constants/environment-variables-group-metadata';
import { EnvironmentVariablesGroup } from 'src/engine/core-modules/environment/enums/environment-variables-group.enum';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { FeatureFlagKey } from 'src/engine/core-modules/feature-flag/enums/feature-flag-key.enum';
import { FeatureFlag } from 'src/engine/core-modules/feature-flag/feature-flag.entity';
import {
  FeatureFlagException,
  FeatureFlagExceptionCode,
} from 'src/engine/core-modules/feature-flag/feature-flag.exception';
import { featureFlagValidator } from 'src/engine/core-modules/feature-flag/validates/feature-flag.validate';
import { User } from 'src/engine/core-modules/user/user.entity';
import { userValidator } from 'src/engine/core-modules/user/user.validate';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { workspaceValidator } from 'src/engine/core-modules/workspace/workspace.validate';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';

import { LinkedinStoredCookieValidationService } from 'src/engine/core-modules/arx-chat/services/linkedin-stored-cookie-validation.service';

const pickStringFromRow = (
  row: Record<string, unknown>,
  key: string,
): string | null => {
  const v = row[key];

  if (v === null || v === undefined) {
    return null;
  }

  if (typeof v === 'boolean') {
    return v ? 'true' : 'false';
  }

  return String(v);
};

const pickBooleanFromRow = (
  row: Record<string, unknown>,
  key: string,
): boolean | null => {
  const v = row[key];

  if (v === null || v === undefined) {
    return null;
  }

  if (typeof v === 'boolean') {
    return v;
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

@Injectable()
export class AdminPanelService {
  private readonly logger = new Logger(AdminPanelService.name);

  constructor(
    private readonly loginTokenService: LoginTokenService,
    private readonly accessTokenService: AccessTokenService,
    private readonly linkedinStoredCookieValidationService: LinkedinStoredCookieValidationService,
    private readonly environmentService: EnvironmentService,
    private readonly domainManagerService: DomainManagerService,
    @InjectRepository(User, 'core')
    private readonly userRepository: Repository<User>,
    @InjectRepository(Workspace, 'core')
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(FeatureFlag, 'core')
    private readonly featureFlagRepository: Repository<FeatureFlag>,
    private readonly workspaceDataSourceService: WorkspaceDataSourceService,
    @InjectDataSource('metadata')
    private readonly metadataDataSource: DataSource,
  ) {}

  async impersonate(userId: string, workspaceId: string) {
    const user = await this.userRepository.findOne({
      where: {
        id: userId,
        workspaces: {
          workspaceId,
          workspace: {
            allowImpersonation: true,
          },
        },
      },
      relations: ['workspaces', 'workspaces.workspace'],
    });

    userValidator.assertIsDefinedOrThrow(
      user,
      new AuthException(
        'User not found or impersonation not enable on workspace',
        AuthExceptionCode.INVALID_INPUT,
      ),
    );

    const loginToken = await this.loginTokenService.generateLoginToken(
      user.email,
      user.workspaces[0].workspace.id,
    );

    return {
      workspace: {
        id: user.workspaces[0].workspace.id,
        workspaceUrls: this.domainManagerService.getWorkspaceUrls(
          user.workspaces[0].workspace,
        ),
        displayName: user.workspaces[0].workspace.displayName ?? null,
      },
      loginToken,
    };
  }

  async userLookup(userIdentifier: string): Promise<UserLookup> {
    const isEmail = userIdentifier.includes('@');

    const targetUser = await this.userRepository.findOne({
      where: isEmail ? { email: userIdentifier } : { id: userIdentifier },
      relations: [
        'workspaces',
        'workspaces.workspace',
        'workspaces.workspace.workspaceUsers',
        'workspaces.workspace.workspaceUsers.user',
        'workspaces.workspace.featureFlags',
      ],
    });

    userValidator.assertIsDefinedOrThrow(
      targetUser,
      new AuthException('User not found', AuthExceptionCode.INVALID_INPUT),
    );

    const allFeatureFlagKeys = Object.values(FeatureFlagKey);

    const workspaces = await Promise.all(
      targetUser.workspaces.map(async (userWorkspace) => {
        const recruiterProfileForLookedUpUser =
          await this.getRecruiterProfileSnapshotForUserInWorkspace(
            userWorkspace.workspace.id,
            targetUser.id,
          );

        return {
          id: userWorkspace.workspace.id,
          name: userWorkspace.workspace.displayName ?? '',
          totalUsers: userWorkspace.workspace.workspaceUsers.length,
          logo: userWorkspace.workspace.logo,
          allowImpersonation: userWorkspace.workspace.allowImpersonation,
          users: userWorkspace.workspace.workspaceUsers.map(
            (workspaceUser) => ({
              id: workspaceUser.user.id,
              email: workspaceUser.user.email,
              firstName: workspaceUser.user.firstName,
              lastName: workspaceUser.user.lastName,
            }),
          ),
          featureFlags: allFeatureFlagKeys.map((key) => ({
            key,
            value:
              userWorkspace.workspace.featureFlags?.find(
                (flag) => flag.key === key,
              )?.value ?? false,
          })) as FeatureFlag[],
          recruiterProfileForLookedUpUser,
        };
      }),
    );

    return {
      user: {
        id: targetUser.id,
        email: targetUser.email,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
      },
      workspaces,
    };
  }

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
          (uw) => !uw.deletedAt && uw.user && !uw.user.deletedAt,
        ) ?? [];

      for (const uw of members) {
        const recruiterProfile =
          await this.getRecruiterProfileSnapshotForUserInWorkspace(
            workspace.id,
            uw.userId,
          );

        rows.push({
          workspaceId: workspace.id,
          workspaceName: workspace.displayName ?? '',
          workspaceSubdomain: workspace.subdomain,
          workspaceCreatedAt: workspace.createdAt,
          userId: uw.user.id,
          userEmail: uw.user.email,
          userFirstName: uw.user.firstName,
          userLastName: uw.user.lastName,
          userCreatedAt: uw.user.createdAt,
          membershipCreatedAt: uw.createdAt,
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
      const result = await this.metadataDataSource.query(
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

  private async getRecruiterProfileSnapshotForUserInWorkspace(
    workspaceId: string,
    userId: string,
  ): Promise<AdminPanelWorkspaceMemberRecruiterProfile | null> {
    const schema = this.workspaceDataSourceService.getSchemaName(workspaceId);

    try {
      const wmRows = await this.workspaceDataSourceService.executeRawQuery(
        `SELECT id FROM ${schema}."workspaceMember" WHERE "userId" = $1 LIMIT 1`,
        [userId],
        workspaceId,
      );

      if (!wmRows?.length) {
        return null;
      }

      const workspaceMemberId = String((wmRows[0] as { id: string }).id);
      const profileTable =
        await this.resolveWorkspaceMemberProfileTableName(schema);

      if (!profileTable) {
        return {
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
        };
      }

      const profileRows = await this.workspaceDataSourceService.executeRawQuery(
        `SELECT * FROM ${schema}."${profileTable}" WHERE "workspaceMemberId" = $1 LIMIT 1`,
        [workspaceMemberId],
        workspaceId,
      );

      if (!profileRows?.length) {
        return {
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
        };
      }

      return this.mapProfileRowToOutput(
        workspaceMemberId,
        profileRows[0] as Record<string, unknown>,
      );
    } catch (error) {
      console.error(
        'getRecruiterProfileSnapshotForUserInWorkspace failed',
        workspaceId,
        userId,
        error,
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

    workspaceValidator.assertIsDefinedOrThrow(
      workspace,
      new AuthException('Workspace not found', AuthExceptionCode.INVALID_INPUT),
    );

    this.logger.log(`Validating member linkedin stored cookies for workspace id: ${workspaceId} and workspace member id: ${workspaceMemberId}`);
    this.logger.log(`Workspace in VALIDATE MEMBER LINKEDIN STORED COOKIES: ${JSON.stringify(workspace, null, 2)}`);

    const schema = this.workspaceDataSourceService.getSchemaName(workspaceId);
    const memberRows = await this.workspaceDataSourceService.executeRawQuery(
      `SELECT id, "userId" FROM ${schema}."workspaceMember" WHERE id = $1 LIMIT 1`,
      [workspaceMemberId],
      workspaceId,
    );

    if (!memberRows?.length) {
      throw new AuthException(
        'Workspace member not found',
        AuthExceptionCode.INVALID_INPUT,
      );
    }

    const memberRow = memberRows[0] as { id: string; userId: string };
    const userId = String(memberRow.userId);
    const authTokenPair = await this.accessTokenService.generateAccessToken(
      userId,
      workspaceId,
    );

    const authContext = await this.accessTokenService.validateToken(
      authTokenPair.token,
    );

    if (authContext.workspaceMemberId !== workspaceMemberId) {
      throw new AuthException(
        'Workspace member mismatch for generated access token',
        AuthExceptionCode.INVALID_INPUT,
      );
    }

    this.logger.log(`Validating member linkedin stored cookies for workspace id: ${workspaceId} and workspace member id: ${workspaceMemberId}`);
    this.logger.log(`Auth token in VALIDATE MEMBER LINKEDIN STORED COOKIES: ${authTokenPair.token}`);
    this.logger.log(`Audience in VALIDATE MEMBER LINKEDIN STORED COOKIES: admin`);
    this.logger.log(`Force disconnect after validation in VALIDATE MEMBER LINKEDIN STORED COOKIES: true`);
    this.logger.log(`Log context in VALIDATE MEMBER LINKEDIN STORED COOKIES: admin panel LinkedIn cookie validation`);

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

    workspaceValidator.assertIsDefinedOrThrow(
      workspace,
      new AuthException('Workspace not found', AuthExceptionCode.INVALID_INPUT),
    );

    this.logger.log(
      `Connecting member LinkedIn Unipile from stored cookies for workspace id: ${workspaceId} and workspace member id: ${workspaceMemberId}`,
    );

    const schema = this.workspaceDataSourceService.getSchemaName(workspaceId);
    const memberRows = await this.workspaceDataSourceService.executeRawQuery(
      `SELECT id, "userId" FROM ${schema}."workspaceMember" WHERE id = $1 LIMIT 1`,
      [workspaceMemberId],
      workspaceId,
    );

    if (!memberRows?.length) {
      throw new AuthException(
        'Workspace member not found',
        AuthExceptionCode.INVALID_INPUT,
      );
    }

    const memberRow = memberRows[0] as { id: string; userId: string };
    const userId = String(memberRow.userId);
    const authTokenPair = await this.accessTokenService.generateAccessToken(
      userId,
      workspaceId,
    );

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

  async updateWorkspaceFeatureFlags(
    workspaceId: string,
    featureFlag: FeatureFlagKey,
    value: boolean,
  ) {
    featureFlagValidator.assertIsFeatureFlagKey(
      featureFlag,
      new FeatureFlagException(
        'Invalid feature flag key',
        FeatureFlagExceptionCode.INVALID_FEATURE_FLAG_KEY,
      ),
    );

    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
      relations: ['featureFlags'],
    });

    workspaceValidator.assertIsDefinedOrThrow(
      workspace,
      new AuthException('Workspace not found', AuthExceptionCode.INVALID_INPUT),
    );

    const existingFlag = workspace.featureFlags?.find(
      (flag) => flag.key === FeatureFlagKey[featureFlag],
    );

    if (existingFlag) {
      await this.featureFlagRepository.update(existingFlag.id, { value });
    } else {
      await this.featureFlagRepository.save({
        key: FeatureFlagKey[featureFlag],
        value,
        workspaceId: workspace.id,
      });
    }
  }

  getEnvironmentVariablesGrouped(): EnvironmentVariablesOutput {
    const rawEnvVars = this.environmentService.getAll();
    const groupedData = new Map<
      EnvironmentVariablesGroup,
      EnvironmentVariable[]
    >();

    for (const [varName, { value, metadata }] of Object.entries(rawEnvVars)) {
      const { group, description } = metadata;

      const envVar: EnvironmentVariable = {
        name: varName,
        description,
        value: String(value),
        sensitive: metadata.sensitive ?? false,
      };

      if (!groupedData.has(group)) {
        groupedData.set(group, []);
      }

      groupedData.get(group)?.push(envVar);
    }

    const groups: EnvironmentVariablesGroupData[] = Array.from(
      groupedData.entries(),
    )
      .sort((a, b) => {
        const positionA = ENVIRONMENT_VARIABLES_GROUP_METADATA[a[0]].position;
        const positionB = ENVIRONMENT_VARIABLES_GROUP_METADATA[b[0]].position;

        return positionA - positionB;
      })
      .map(([name, variables]) => ({
        name,
        description: ENVIRONMENT_VARIABLES_GROUP_METADATA[name].description,
        isHiddenOnLoad:
          ENVIRONMENT_VARIABLES_GROUP_METADATA[name].isHiddenOnLoad,
        variables: variables.sort((a, b) => a.name.localeCompare(b.name)),
      }));

    return { groups };
  }
}
