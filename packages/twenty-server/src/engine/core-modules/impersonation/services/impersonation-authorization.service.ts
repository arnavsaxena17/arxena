import { Injectable } from '@nestjs/common';

import { PermissionFlagType } from 'twenty-shared/constants';

import { userHasAdminPrivileges } from 'src/engine/core-modules/impersonation/utils/user-has-admin-privileges.util';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { PermissionsService } from 'src/engine/metadata-modules/permissions/permissions.service';

export type ImpersonationLevel = 'server' | 'workspace';

export type ImpersonationDenialReason =
  | 'SERVER_LEVEL_NOT_ALLOWED'
  | 'SERVER_LEVEL_2FA_PROVISION_REQUIRED'
  | 'SERVER_LEVEL_2FA_VERIFICATION_REQUIRED'
  | 'WORKSPACE_LEVEL_NOT_ALLOWED'
  | 'TARGET_HAS_ADMIN_PRIVILEGES';

export type ImpersonationAuthorizationResult =
  | { allowed: true; level: ImpersonationLevel }
  | {
      allowed: false;
      level: ImpersonationLevel;
      reason: ImpersonationDenialReason;
    };

@Injectable()
export class ImpersonationAuthorizationService {
  constructor(private readonly permissionsService: PermissionsService) {}

  getImpersonationLevel(
    impersonatorUserWorkspace: UserWorkspaceEntity,
    targetUserWorkspace: UserWorkspaceEntity,
  ): ImpersonationLevel {
    return targetUserWorkspace.workspace.id !==
      impersonatorUserWorkspace.workspace.id
      ? 'server'
      : 'workspace';
  }

  async checkImpersonationAuthorization(
    impersonatorUserWorkspace: UserWorkspaceEntity,
    targetUserWorkspace: UserWorkspaceEntity,
  ): Promise<ImpersonationAuthorizationResult> {
    const level = this.getImpersonationLevel(
      impersonatorUserWorkspace,
      targetUserWorkspace,
    );

    if (level === 'server') {
      return this.checkServerLevelAuthorization(
        impersonatorUserWorkspace,
        targetUserWorkspace,
      );
    }

    return this.checkWorkspaceLevelAuthorization(
      impersonatorUserWorkspace,
      targetUserWorkspace,
    );
  }

  private async checkServerLevelAuthorization(
    impersonatorUserWorkspace: UserWorkspaceEntity,
    targetUserWorkspace: UserWorkspaceEntity,
  ): Promise<ImpersonationAuthorizationResult> {
    const level = 'server' as const;

    if (targetUserWorkspace.workspace.allowImpersonation !== true) {
      return { allowed: false, level, reason: 'SERVER_LEVEL_NOT_ALLOWED' };
    }

    if (impersonatorUserWorkspace.user.canImpersonate === true) {
      // 2FA is temporarily not required for server-level impersonation.
      return { allowed: true, level };
    }

    const hasImpersonatePermission =
      await this.hasImpersonatePermission(impersonatorUserWorkspace);

    if (!hasImpersonatePermission) {
      return { allowed: false, level, reason: 'SERVER_LEVEL_NOT_ALLOWED' };
    }

    if (
      this.isNonAdminImpersonatingAdmin(
        impersonatorUserWorkspace,
        targetUserWorkspace,
      )
    ) {
      return { allowed: false, level, reason: 'TARGET_HAS_ADMIN_PRIVILEGES' };
    }

    return { allowed: true, level };
  }

  private async checkWorkspaceLevelAuthorization(
    impersonatorUserWorkspace: UserWorkspaceEntity,
    targetUserWorkspace: UserWorkspaceEntity,
  ): Promise<ImpersonationAuthorizationResult> {
    const level = 'workspace' as const;

    const hasWorkspaceLevelImpersonatePermission =
      await this.permissionsService.userHasWorkspaceSettingPermission({
        userWorkspaceId: impersonatorUserWorkspace.id,
        setting: PermissionFlagType.IMPERSONATE,
        workspaceId: targetUserWorkspace.workspace.id,
      });

    if (!hasWorkspaceLevelImpersonatePermission) {
      return { allowed: false, level, reason: 'WORKSPACE_LEVEL_NOT_ALLOWED' };
    }

    if (
      this.isNonAdminImpersonatingAdmin(
        impersonatorUserWorkspace,
        targetUserWorkspace,
      )
    ) {
      return { allowed: false, level, reason: 'TARGET_HAS_ADMIN_PRIVILEGES' };
    }

    return { allowed: true, level };
  }

  private hasImpersonatePermission(
    impersonatorUserWorkspace: UserWorkspaceEntity,
  ): Promise<boolean> {
    return this.permissionsService.userHasWorkspaceSettingPermission({
      userWorkspaceId: impersonatorUserWorkspace.id,
      setting: PermissionFlagType.IMPERSONATE,
      workspaceId: impersonatorUserWorkspace.workspace.id,
    });
  }

  private isNonAdminImpersonatingAdmin(
    impersonatorUserWorkspace: UserWorkspaceEntity,
    targetUserWorkspace: UserWorkspaceEntity,
  ): boolean {
    return (
      userHasAdminPrivileges(targetUserWorkspace.user) &&
      !userHasAdminPrivileges(impersonatorUserWorkspace.user)
    );
  }
}
