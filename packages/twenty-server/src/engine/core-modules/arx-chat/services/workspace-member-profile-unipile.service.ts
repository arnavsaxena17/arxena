import { Injectable, Logger } from '@nestjs/common';
import {
  findWorkspaceMemberProfiles,
  graphQLToUpdateOneWorkspaceMemberProfile,
} from 'twenty-shared';

import { StaticGraphQLService } from 'src/engine/core-modules/graphql/static-graphql.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

type UnipileAccountType = 'linkedin' | 'whatsapp';

@Injectable()
export class WorkspaceMemberProfileUnipileService {
  private readonly logger = new Logger(
    WorkspaceMemberProfileUnipileService.name,
  );

  constructor(
    private readonly staticGraphQLService: StaticGraphQLService,
    private readonly workspaceQueryService: WorkspaceQueryService,
  ) {}

  /**
   * Get Unipile account ID for a workspace member.
   * Step 1: If workspaceMemberId provided, check workspaceMemberProfile for linkedinUnipileAccountId / whatsappUnipileAccountId
   * Step 2 (fallback): If profile has no account or workspaceMemberId is null, return core.workspace.linkedin_unipile_account_id / whatsapp_unipile_account_id
   */
  async getWorkspaceMemberUnipileAccountId(
    workspaceMemberId: string | null,
    workspaceId: string,
    authToken: string,
    type: UnipileAccountType,
  ): Promise<string | null> {
    const fieldName =
      type === 'linkedin' ? 'linkedinUnipileAccountId' : 'whatsappUnipileAccountId';

    try {
      if (workspaceMemberId) {
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
      }

      const workspaceKey =
        type === 'linkedin' ? 'linkedin_unipile_account_id' : 'whatsapp_unipile_account_id';
      const workspaceAccountId = await this.workspaceQueryService.getWorkspaceApiKey(
        workspaceId,
        workspaceKey,
      );

      if (workspaceAccountId && String(workspaceAccountId).trim()) {
        return String(workspaceAccountId).trim();
      }

      return null;
    } catch (error) {
      this.logger.warn(
        `Failed to get ${fieldName} for workspace member ${workspaceMemberId}:`,
        error,
      );
      const workspaceKey =
        type === 'linkedin' ? 'linkedin_unipile_account_id' : 'whatsapp_unipile_account_id';
      return this.workspaceQueryService.getWorkspaceApiKey(
        workspaceId,
        workspaceKey,
      );
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
    } catch (error) {
      this.logger.warn(
        `Failed to clear ${fieldName} for workspace member ${workspaceMemberId}:`,
        error,
      );
    }
  }
}
