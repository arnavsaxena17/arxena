import { Injectable, Logger } from '@nestjs/common';
import {
  findWorkspaceMemberProfiles,
  graphQLToUpdateOneWorkspaceMemberProfile,
} from 'twenty-shared';

import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

type UnipileAccountType = 'linkedin' | 'whatsapp';
type WorkspaceMemberLinkedinCookieTokens = {
  linkedinLiAtToken: string | null;
  linkedinLiAToken: string | null;
};

@Injectable()
export class WorkspaceMemberProfileUnipileService {
  private readonly logger = new Logger(
    WorkspaceMemberProfileUnipileService.name,
  );

  constructor(
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly workspaceQueryService: WorkspaceQueryService,
  ) {}

  private async ensureWorkspaceMemberProfileTableContext(workspaceId: string) {
    const schema = this.workspaceQueryService.getDataSourceSchema(workspaceId);
    const profileTable =
      await this.workspaceQueryService.resolveWorkspaceMemberProfileTableName(
        schema,
      );

    if (!profileTable) {
      throw new Error(
        `Workspace member profile table not found for workspace ${workspaceId}`,
      );
    }

    return { schema, profileTable };
  }

  private async ensureWorkspaceMemberProfileRowExists(
    workspaceId: string,
    workspaceMemberId: string,
    schema: string,
    profileTable: string,
  ): Promise<void> {
    const hasTypeColumn = await this.workspaceQueryService.checkIfColumnExists(
      schema,
      profileTable,
      'typeWorkspaceMember',
      { silent: true },
    );

    const insertQuery = hasTypeColumn
      ? `INSERT INTO ${schema}."${profileTable}"
          ("id", "workspaceMemberId", "createdAt", "updatedAt", "typeWorkspaceMember")
         SELECT gen_random_uuid(), $1, NOW(), NOW(), 'recruiterType'
         WHERE NOT EXISTS (
           SELECT 1 FROM ${schema}."${profileTable}" p
           WHERE p."workspaceMemberId" = $1
         )`
      : `INSERT INTO ${schema}."${profileTable}"
          ("id", "workspaceMemberId", "createdAt", "updatedAt")
         SELECT gen_random_uuid(), $1, NOW(), NOW()
         WHERE NOT EXISTS (
           SELECT 1 FROM ${schema}."${profileTable}" p
           WHERE p."workspaceMemberId" = $1
         )`;

    await this.workspaceQueryService.workspaceDataSourceService.executeRawQuery(
      insertQuery,
      [workspaceMemberId],
      workspaceId,
    );
  }

  private async ensureLinkedinCookieColumns(
    workspaceId: string,
    schema: string,
    profileTable: string,
  ): Promise<void> {
    const hasLiAtColumn = await this.workspaceQueryService.checkIfColumnExists(
      schema,
      profileTable,
      'linkedinLiAtToken',
      { silent: true },
    );

    if (!hasLiAtColumn) {
      await this.workspaceQueryService.workspaceDataSourceService.executeRawQuery(
        `ALTER TABLE ${schema}."${profileTable}"
         ADD COLUMN IF NOT EXISTS "linkedinLiAtToken" TEXT`,
        [],
        workspaceId,
      );
    }

    const hasLiAColumn = await this.workspaceQueryService.checkIfColumnExists(
      schema,
      profileTable,
      'linkedinLiAToken',
      { silent: true },
    );

    if (!hasLiAColumn) {
      await this.workspaceQueryService.workspaceDataSourceService.executeRawQuery(
        `ALTER TABLE ${schema}."${profileTable}"
         ADD COLUMN IF NOT EXISTS "linkedinLiAToken" TEXT`,
        [],
        workspaceId,
      );
    }
  }

  async updateWorkspaceMemberLinkedinCookieTokens(
    workspaceId: string,
    workspaceMemberId: string,
    tokens: Partial<WorkspaceMemberLinkedinCookieTokens>,
  ): Promise<void> {
    const { schema, profileTable } =
      await this.ensureWorkspaceMemberProfileTableContext(workspaceId);

    await this.ensureLinkedinCookieColumns(workspaceId, schema, profileTable);
    await this.ensureWorkspaceMemberProfileRowExists(
      workspaceId,
      workspaceMemberId,
      schema,
      profileTable,
    );

    const updates: string[] = [];
    const parameters: Array<string | null> = [];

    if (tokens.linkedinLiAtToken !== undefined) {
      parameters.push(tokens.linkedinLiAtToken);
      updates.push(`"linkedinLiAtToken" = $${parameters.length}`);
    }

    if (tokens.linkedinLiAToken !== undefined) {
      parameters.push(tokens.linkedinLiAToken);
      updates.push(`"linkedinLiAToken" = $${parameters.length}`);
    }

    if (updates.length === 0) {
      return;
    }

    parameters.push(workspaceMemberId);

    await this.workspaceQueryService.workspaceDataSourceService.executeRawQuery(
      `UPDATE ${schema}."${profileTable}"
       SET ${updates.join(', ')},
           "updatedAt" = NOW()
       WHERE "workspaceMemberId" = $${parameters.length}`,
      parameters,
      workspaceId,
    );
  }

  async getWorkspaceMemberLinkedinCookieTokens(
    workspaceId: string,
    workspaceMemberId: string,
  ): Promise<WorkspaceMemberLinkedinCookieTokens> {
    const { schema, profileTable } =
      await this.ensureWorkspaceMemberProfileTableContext(workspaceId);

    await this.ensureLinkedinCookieColumns(workspaceId, schema, profileTable);

    const rows =
      await this.workspaceQueryService.workspaceDataSourceService.executeRawQuery(
        `SELECT "linkedinLiAtToken", "linkedinLiAToken"
         FROM ${schema}."${profileTable}"
         WHERE "workspaceMemberId" = $1
         LIMIT 1`,
        [workspaceMemberId],
        workspaceId,
      );

    return {
      linkedinLiAtToken: rows?.[0]?.linkedinLiAtToken ?? null,
      linkedinLiAToken: rows?.[0]?.linkedinLiAToken ?? null,
    };
  }

  /**
   * Get Unipile account ID for a workspace member from workspaceMemberProfile only.
   * Workspace-wide whatsapp_unipile_account_id / linkedin_unipile_account_id keys are deprecated
   * (multiple members may each have their own Unipile account).
   */
  async getWorkspaceMemberUnipileAccountId(
    workspaceMemberId: string | null,
    _workspaceId: string,
    authToken: string,
    type: UnipileAccountType,
  ): Promise<string | null> {
    const fieldName =
      type === 'linkedin' ? 'linkedinUnipileAccountId' : 'whatsappUnipileAccountId';

    try {
      if (!workspaceMemberId) {
        return null;
      }

      const response = await this.staticGraphQLService.executeGraphQL(
        findWorkspaceMemberProfiles,
        { filter: { workspaceMemberId: { eq: workspaceMemberId } }, limit: 1 },
        authToken,
      );

      const profile = response?.data?.data?.workspaceMemberProfiles?.edges?.[0]
        ?.node;
      const profileAccountId = profile?.[fieldName];

      if (profileAccountId && String(profileAccountId).trim()) {
        return String(profileAccountId).trim();
      }

      return null;
    } catch (error) {
      this.logger.warn(
        `Failed to get ${fieldName} for workspace member ${workspaceMemberId}:`,
        error,
      );

      return null;
    }
  }

  /**
   * Check if workspace member has keepLinkedinConnected flag set.
   */
  async getKeepLinkedinConnected(
    workspaceMemberId: string,
    authToken: string,
  ): Promise<boolean> {
    try {
      const response = await this.staticGraphQLService.executeGraphQL(
        findWorkspaceMemberProfiles,
        { filter: { workspaceMemberId: { eq: workspaceMemberId } }, limit: 1 },
        authToken,
      );

      const profile = response?.data?.data?.workspaceMemberProfiles?.edges?.[0]
        ?.node;
      return Boolean(profile?.keepLinkedinConnected);
    } catch {
      return false;
    }
  }

  /**
   * Update workspace member profile with Unipile account ID.
   * First finds the profile by workspaceMemberId, then updates it.
   */
  async updateWorkspaceMemberUnipileAccountId(
    workspaceMemberId: string,
    authToken: string,
    type: UnipileAccountType,
    accountId: string,
  ): Promise<void> {
    const fieldName =
      type === 'linkedin' ? 'linkedinUnipileAccountId' : 'whatsappUnipileAccountId';

    try {
      const response = await this.staticGraphQLService.executeGraphQL(
        findWorkspaceMemberProfiles,
        { filter: { workspaceMemberId: { eq: workspaceMemberId } }, limit: 1 },
        authToken,
      );

      const profile = response?.data?.data?.workspaceMemberProfiles?.edges?.[0]
        ?.node;

      if (!profile?.id) {
        this.logger.warn(
          `No workspace member profile found for ${workspaceMemberId}, cannot update ${fieldName}`,
        );
        return;
      }

      await this.staticGraphQLService.executeGraphQL(
        graphQLToUpdateOneWorkspaceMemberProfile,
        {
          idToUpdate: profile.id,
          input: { [fieldName]: accountId },
        },
        authToken,
      );

      try {
        const workspaceId =
          await this.workspaceQueryService.getWorkspaceIdFromToken(authToken);
        await this.workspaceQueryService.upsertUnipileMemberAccountMapping(
          workspaceMemberId,
          workspaceId,
          accountId,
          type === 'linkedin' ? 'LINKEDIN' : 'WHATSAPP',
        );
      } catch (mappingError) {
        this.logger.warn(
          `Failed to sync metadata.unipile_accounts for ${workspaceMemberId}:`,
          mappingError,
        );
      }

      this.logger.log(
        `Updated ${fieldName} for workspace member ${workspaceMemberId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update ${fieldName} for workspace member ${workspaceMemberId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Clear Unipile account ID from workspace member profile (e.g. on disconnect).
   */
  async clearWorkspaceMemberUnipileAccountId(
    workspaceMemberId: string,
    authToken: string,
    type: UnipileAccountType,
  ): Promise<void> {
    const fieldName =
      type === 'linkedin' ? 'linkedinUnipileAccountId' : 'whatsappUnipileAccountId';

    try {
      const response = await this.staticGraphQLService.executeGraphQL(
        findWorkspaceMemberProfiles,
        { filter: { workspaceMemberId: { eq: workspaceMemberId } }, limit: 1 },
        authToken,
      );

      const profile = response?.data?.data?.workspaceMemberProfiles?.edges?.[0]
        ?.node;

      if (!profile?.id) {
        return;
      }

      await this.staticGraphQLService.executeGraphQL(
        graphQLToUpdateOneWorkspaceMemberProfile,
        {
          idToUpdate: profile.id,
          input: { [fieldName]: null },
        },
        authToken,
      );

      await this.workspaceQueryService.deleteUnipileMemberAccountMapping(
        workspaceMemberId,
        type === 'linkedin' ? 'LINKEDIN' : 'WHATSAPP',
      );
    } catch (error) {
      this.logger.warn(
        `Failed to clear ${fieldName} for workspace member ${workspaceMemberId}:`,
        error,
      );
    }
  }
}
