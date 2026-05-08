import { Injectable } from '@nestjs/common';

import { WorkspaceActivationStatus } from 'twenty-shared';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { OnboardingIntentPath } from 'src/engine/core-modules/onboarding/enums/onboarding-intent-path.enum';
import { OnboardingStatus } from 'src/engine/core-modules/onboarding/enums/onboarding-status.enum';
import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';
import { User } from 'src/engine/core-modules/user/user.entity';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';

export enum OnboardingStepKeys {
  ONBOARDING_CONNECT_ACCOUNT_PENDING = 'ONBOARDING_CONNECT_ACCOUNT_PENDING',
  ONBOARDING_CONNECT_LINKEDIN_PENDING = 'ONBOARDING_CONNECT_LINKEDIN_PENDING',
  ONBOARDING_INVITE_TEAM_PENDING = 'ONBOARDING_INVITE_TEAM_PENDING',
  ONBOARDING_CREATE_PROFILE_PENDING = 'ONBOARDING_CREATE_PROFILE_PENDING',
  ONBOARDING_INTENT_CHOICE_PENDING = 'ONBOARDING_INTENT_CHOICE_PENDING',
  ONBOARDING_INTENT_PATH = 'ONBOARDING_INTENT_PATH',
}

export type OnboardingKeyValueTypeMap = {
  [OnboardingStepKeys.ONBOARDING_CONNECT_ACCOUNT_PENDING]: boolean;
  [OnboardingStepKeys.ONBOARDING_CONNECT_LINKEDIN_PENDING]: boolean;
  [OnboardingStepKeys.ONBOARDING_INVITE_TEAM_PENDING]: boolean;
  [OnboardingStepKeys.ONBOARDING_CREATE_PROFILE_PENDING]: boolean;
  [OnboardingStepKeys.ONBOARDING_INTENT_CHOICE_PENDING]: boolean;
  [OnboardingStepKeys.ONBOARDING_INTENT_PATH]: OnboardingIntentPath;
};

@Injectable()
export class OnboardingService {
  constructor(
    private readonly userVarsService: UserVarsService<OnboardingKeyValueTypeMap>,
    private readonly environmentService: EnvironmentService,
  ) {}

  private isWorkspaceActivationPending(workspace: Workspace) {
    return (
      workspace.activationStatus === WorkspaceActivationStatus.PENDING_CREATION
    );
  }

  async getOnboardingStatus(user: User, workspace: Workspace) {
    if (this.isWorkspaceActivationPending(workspace)) {
      return OnboardingStatus.WORKSPACE_ACTIVATION;
    }

    const userVars = await this.userVarsService.getAll({
      userId: user.id,
      workspaceId: workspace.id,
    });

    const isProfileCreationPending =
      userVars.get(OnboardingStepKeys.ONBOARDING_CREATE_PROFILE_PENDING) ===
      true;

    const isConnectLinkedinPending =
      userVars.get(OnboardingStepKeys.ONBOARDING_CONNECT_LINKEDIN_PENDING) ===
      true;

    const isConnectAccountPending =
      userVars.get(OnboardingStepKeys.ONBOARDING_CONNECT_ACCOUNT_PENDING) ===
      true;

    const isInviteTeamPending =
      userVars.get(OnboardingStepKeys.ONBOARDING_INVITE_TEAM_PENDING) === true;
    const isIntentChoicePending =
      userVars.get(OnboardingStepKeys.ONBOARDING_INTENT_CHOICE_PENDING) ===
      true;
    const onboardingIntentPath = userVars.get(
      OnboardingStepKeys.ONBOARDING_INTENT_PATH,
    );

    if (isProfileCreationPending) {
      return OnboardingStatus.PROFILE_CREATION;
    }

    if (this.environmentService.get('USE_INTENT_CHOICE_ONBOARDING')) {
      if (isIntentChoicePending) {
        return OnboardingStatus.INTENT_CHOICE;
      }

      switch (onboardingIntentPath) {
        case OnboardingIntentPath.COMPETITIVE_RESEARCH:
          return OnboardingStatus.COMPETITIVE_RESEARCH;
        case OnboardingIntentPath.CORPORATE_TA:
          return OnboardingStatus.CORPORATE_TA;
        case OnboardingIntentPath.DEAL_DILIGENCE:
          return OnboardingStatus.DEAL_DILIGENCE;
        case OnboardingIntentPath.EXTENSION_INSTALL:
          return OnboardingStatus.EXTENSION_INSTALL;
      }

      return OnboardingStatus.COMPLETED;
    }

    if (
      isConnectLinkedinPending &&
      this.environmentService.get('USE_CONNECT_LINKEDIN_ONBOARDING')
    ) {
      return OnboardingStatus.CONNECT_LINKEDIN;
    }

    if (
      this.environmentService.get('SKIP_OPTIONAL_ONBOARDING_STEPS') &&
      (isConnectAccountPending || isInviteTeamPending)
    ) {
      return OnboardingStatus.COMPLETED;
    }

    if (isConnectAccountPending) {
      return OnboardingStatus.SYNC_EMAIL;
    }

    if (isInviteTeamPending) {
      return OnboardingStatus.INVITE_TEAM;
    }

    return OnboardingStatus.COMPLETED;
  }

  async setOnboardingConnectAccountPending({
    userId,
    workspaceId,
    value,
  }: {
    userId: string;
    workspaceId: string;
    value: boolean;
  }) {
    if (!value) {
      await this.userVarsService.delete({
        userId,
        workspaceId,
        key: OnboardingStepKeys.ONBOARDING_CONNECT_ACCOUNT_PENDING,
      });

      return;
    }

    await this.userVarsService.set({
      userId,
      workspaceId: workspaceId,
      key: OnboardingStepKeys.ONBOARDING_CONNECT_ACCOUNT_PENDING,
      value: true,
    });
  }

  async setOnboardingConnectLinkedinPending({
    userId,
    workspaceId,
    value,
  }: {
    userId: string;
    workspaceId: string;
    value: boolean;
  }) {
    if (!value) {
      await this.userVarsService.delete({
        userId,
        workspaceId,
        key: OnboardingStepKeys.ONBOARDING_CONNECT_LINKEDIN_PENDING,
      });

      return;
    }

    await this.userVarsService.set({
      userId,
      workspaceId,
      key: OnboardingStepKeys.ONBOARDING_CONNECT_LINKEDIN_PENDING,
      value: true,
    });
  }

  async setOnboardingInviteTeamPending({
    workspaceId,
    value,
  }: {
    workspaceId: string;
    value: boolean;
  }) {
    if (!value) {
      await this.userVarsService.delete({
        workspaceId,
        key: OnboardingStepKeys.ONBOARDING_INVITE_TEAM_PENDING,
      });

      return;
    }

    await this.userVarsService.set({
      workspaceId,
      key: OnboardingStepKeys.ONBOARDING_INVITE_TEAM_PENDING,
      value: true,
    });
  }

  async setOnboardingCreateProfilePending({
    userId,
    workspaceId,
    value,
  }: {
    userId: string;
    workspaceId: string;
    value: boolean;
  }) {
    if (!value) {
      await this.userVarsService.delete({
        userId,
        workspaceId,
        key: OnboardingStepKeys.ONBOARDING_CREATE_PROFILE_PENDING,
      });

      return;
    }

    await this.userVarsService.set({
      userId,
      workspaceId,
      key: OnboardingStepKeys.ONBOARDING_CREATE_PROFILE_PENDING,
      value: true,
    });
  }

  async setOnboardingIntentChoicePending({
    userId,
    workspaceId,
    value,
  }: {
    userId: string;
    workspaceId: string;
    value: boolean;
  }) {
    if (!value) {
      await this.userVarsService.delete({
        userId,
        workspaceId,
        key: OnboardingStepKeys.ONBOARDING_INTENT_CHOICE_PENDING,
      });

      return;
    }

    await this.userVarsService.set({
      userId,
      workspaceId,
      key: OnboardingStepKeys.ONBOARDING_INTENT_CHOICE_PENDING,
      value: true,
    });
  }

  async setOnboardingIntentPath({
    userId,
    workspaceId,
    path,
  }: {
    userId: string;
    workspaceId: string;
    path: OnboardingIntentPath;
  }) {
    await this.userVarsService.set({
      userId,
      workspaceId,
      key: OnboardingStepKeys.ONBOARDING_INTENT_PATH,
      value: path,
    });
  }

  async clearOnboardingIntentPath({
    userId,
    workspaceId,
  }: {
    userId: string;
    workspaceId: string;
  }) {
    await this.userVarsService.delete({
      userId,
      workspaceId,
      key: OnboardingStepKeys.ONBOARDING_INTENT_PATH,
    });
  }
}
