import { Injectable } from '@nestjs/common';

import { WorkspaceActivationStatus } from 'twenty-shared';

import { BillingService } from 'src/engine/core-modules/billing/services/billing.service';
import { OnboardingStatus } from 'src/engine/core-modules/onboarding/enums/onboarding-status.enum';
import { UserVarsService } from 'src/engine/core-modules/user/user-vars/services/user-vars.service';
import { User } from 'src/engine/core-modules/user/user.entity';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';

export enum OnboardingStepKeys {
  ONBOARDING_CONNECT_ACCOUNT_PENDING = 'ONBOARDING_CONNECT_ACCOUNT_PENDING',
  ONBOARDING_CONNECT_LINKEDIN_PENDING = 'ONBOARDING_CONNECT_LINKEDIN_PENDING',
  ONBOARDING_INSTALL_APP_PENDING = 'ONBOARDING_INSTALL_APP_PENDING',
  ONBOARDING_INVITE_TEAM_PENDING = 'ONBOARDING_INVITE_TEAM_PENDING',
  ONBOARDING_CREATE_PROFILE_PENDING = 'ONBOARDING_CREATE_PROFILE_PENDING',
}

export type OnboardingKeyValueTypeMap = {
  [OnboardingStepKeys.ONBOARDING_CONNECT_ACCOUNT_PENDING]: boolean;
  [OnboardingStepKeys.ONBOARDING_CONNECT_LINKEDIN_PENDING]: boolean;
  [OnboardingStepKeys.ONBOARDING_INSTALL_APP_PENDING]: boolean;
  [OnboardingStepKeys.ONBOARDING_INVITE_TEAM_PENDING]: boolean;
  [OnboardingStepKeys.ONBOARDING_CREATE_PROFILE_PENDING]: boolean;
};

@Injectable()
export class OnboardingService {
  constructor(
    private readonly billingService: BillingService,
    private readonly userVarsService: UserVarsService<OnboardingKeyValueTypeMap>,
  ) {}

  private async isSubscriptionIncompleteOnboardingStatus(workspace: Workspace) {
    const hasAnySubscription =
      await this.billingService.hasWorkspaceAnySubscription(workspace.id);

    return !hasAnySubscription;
  }

  private isWorkspaceActivationPending(workspace: Workspace) {
    return (
      workspace.activationStatus === WorkspaceActivationStatus.PENDING_CREATION
    );
  }

  async getOnboardingStatus(user: User, workspace: Workspace) {
    const subscriptionIncomplete =
      await this.isSubscriptionIncompleteOnboardingStatus(workspace);

    if (subscriptionIncomplete) {
      return OnboardingStatus.WORKSPACE_ACTIVATION;
    }

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

    const isInstallAppPending =
      userVars.get(OnboardingStepKeys.ONBOARDING_INSTALL_APP_PENDING) === true;

    const isConnectAccountPending =
      userVars.get(OnboardingStepKeys.ONBOARDING_CONNECT_ACCOUNT_PENDING) ===
      true;

    const isInviteTeamPending =
      userVars.get(OnboardingStepKeys.ONBOARDING_INVITE_TEAM_PENDING) === true;

    if (isProfileCreationPending) {
      return OnboardingStatus.PROFILE_CREATION;
    }

    if (isConnectLinkedinPending) {
      return OnboardingStatus.CONNECT_LINKEDIN;
    }

    if (isInstallAppPending) {
      return OnboardingStatus.INSTALL_APP;
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

  async setOnboardingInstallAppPending({
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
        key: OnboardingStepKeys.ONBOARDING_INSTALL_APP_PENDING,
      });

      return;
    }

    await this.userVarsService.set({
      userId,
      workspaceId,
      key: OnboardingStepKeys.ONBOARDING_INSTALL_APP_PENDING,
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
}
