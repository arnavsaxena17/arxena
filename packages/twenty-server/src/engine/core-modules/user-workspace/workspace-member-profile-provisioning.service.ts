import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import { type ObjectLiteral } from 'typeorm';

import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';

type WorkspaceMemberProfileRecord = ObjectLiteral & {
  id: string;
  workspaceMemberId: string;
  typeWorkspaceMember?: string | null;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
};

type WorkspaceMemberProfileSource = {
  name?: { firstName?: string; lastName?: string } | null;
  userEmail?: string | null;
  phoneNumber?: string | null;
};

const RECRUITER_TYPE_WORKSPACE_MEMBER = 'RECRUITER_TYPE';

// Creates default workspaceMemberProfile rows for new workspace members.
// Lives in user-workspace (not workspace-modifications) to avoid Nest circular deps.
@Injectable()
export class WorkspaceMemberProfileProvisioningService {
  private readonly logger = new Logger(
    WorkspaceMemberProfileProvisioningService.name,
  );

  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async ensureWorkspaceMemberProfileForNewMember(
    workspaceId: string,
    workspaceMemberId: string,
    member?: WorkspaceMemberProfileSource,
  ): Promise<void> {
    if (!isNonEmptyString(workspaceId) || !isNonEmptyString(workspaceMemberId)) {
      return;
    }

    try {
      await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
        async () => {
          const profileRepository =
            await this.getWorkspaceMemberProfileRepository(workspaceId);

          if (!isDefined(profileRepository)) {
            return;
          }

          const existingProfile = await profileRepository.findOne({
            where: { workspaceMemberId },
            select: { id: true },
          });

          if (isDefined(existingProfile)) {
            return;
          }

          const profileFields = this.buildProfileFieldsFromMember(member);

          await profileRepository.insert({
            workspaceMemberId,
            typeWorkspaceMember: RECRUITER_TYPE_WORKSPACE_MEMBER,
            ...profileFields,
          });
        },
        buildSystemAuthContext(workspaceId),
      );
    } catch (error) {
      this.logger.error(
        `ensureWorkspaceMemberProfileForNewMember failed for member ${workspaceMemberId} workspace ${workspaceId}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  // Keeps workspaceMemberProfile in sync with workspaceMember (name, email, phone).
  // Ensures a profile row exists, then updates display fields. Safe on CREATED/UPDATED.
  async syncWorkspaceMemberProfileFromWorkspaceMemberData(
    workspaceId: string,
    workspaceMemberId: string,
    member: WorkspaceMemberProfileSource,
  ): Promise<void> {
    await this.ensureWorkspaceMemberProfileForNewMember(
      workspaceId,
      workspaceMemberId,
      member,
    );

    if (!isNonEmptyString(workspaceId) || !isNonEmptyString(workspaceMemberId)) {
      return;
    }

    try {
      await this.globalWorkspaceOrmManager.executeInWorkspaceContext(
        async () => {
          const profileRepository =
            await this.getWorkspaceMemberProfileRepository(workspaceId);

          if (!isDefined(profileRepository)) {
            return;
          }

          const profileFields = this.buildProfileFieldsFromMember(member);

          await profileRepository.update(
            { workspaceMemberId },
            profileFields,
          );
        },
        buildSystemAuthContext(workspaceId),
      );
    } catch (error) {
      this.logger.error(
        `syncWorkspaceMemberProfileFromWorkspaceMemberData failed for member ${workspaceMemberId} workspace ${workspaceId}`,
        error instanceof Error ? error.stack : error,
      );
    }
  }

  private buildProfileFieldsFromMember(
    member?: WorkspaceMemberProfileSource,
  ): Partial<WorkspaceMemberProfileRecord> {
    const firstName = member?.name?.firstName ?? '';
    const lastName = member?.name?.lastName ?? '';
    const displayName =
      [firstName, lastName].filter(isNonEmptyString).join(' ').trim() ||
      'Untitled';

    return {
      name: displayName,
      firstName,
      lastName,
      email: member?.userEmail ?? '',
      phoneNumber: member?.phoneNumber ?? '',
    };
  }

  private async getWorkspaceMemberProfileRepository(workspaceId: string) {
    try {
      return await this.globalWorkspaceOrmManager.getRepository<WorkspaceMemberProfileRecord>(
        workspaceId,
        'workspaceMemberProfile',
        { shouldBypassPermissionChecks: true },
      );
    } catch (error) {
      // Object may not exist yet if arxena standard has not been synced.
      this.logger.warn(
        `workspaceMemberProfile unavailable for workspace ${workspaceId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
  }
}
