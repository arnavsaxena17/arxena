import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';

import { OnboardingStepSuccess } from 'src/engine/core-modules/onboarding/dtos/onboarding-step-success.dto';
import { OnboardingIntentPath } from 'src/engine/core-modules/onboarding/enums/onboarding-intent-path.enum';
import { OnboardingService } from 'src/engine/core-modules/onboarding/onboarding.service';
import { User } from 'src/engine/core-modules/user/user.entity';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthUser } from 'src/engine/decorators/auth/auth-user.decorator';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { UserAuthGuard } from 'src/engine/guards/user-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

@UseGuards(WorkspaceAuthGuard, UserAuthGuard)
@Resolver()
export class OnboardingResolver {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Mutation(() => OnboardingStepSuccess)
  async setOnboardingIntentChoicePending(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ): Promise<OnboardingStepSuccess> {
    await this.onboardingService.clearOnboardingIntentPath({
      userId: user.id,
      workspaceId: workspace.id,
    });
    await this.onboardingService.setOnboardingIntentChoicePending({
      userId: user.id,
      workspaceId: workspace.id,
      value: true,
    });

    return { success: true };
  }

  @Mutation(() => OnboardingStepSuccess)
  async submitOnboardingIntentPath(
    @Args('path', { type: () => OnboardingIntentPath })
    path: OnboardingIntentPath,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ): Promise<OnboardingStepSuccess> {
    await this.onboardingService.setOnboardingIntentChoicePending({
      userId: user.id,
      workspaceId: workspace.id,
      value: false,
    });
    await this.onboardingService.setOnboardingIntentPath({
      userId: user.id,
      workspaceId: workspace.id,
      path,
    });

    return { success: true };
  }

  @Mutation(() => OnboardingStepSuccess)
  async completeOnboardingIntentPathStep(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ): Promise<OnboardingStepSuccess> {
    await this.onboardingService.clearOnboardingIntentPath({
      userId: user.id,
      workspaceId: workspace.id,
    });
    await this.onboardingService.setOnboardingIntentChoicePending({
      userId: user.id,
      workspaceId: workspace.id,
      value: false,
    });

    return { success: true };
  }

  @Mutation(() => OnboardingStepSuccess)
  async skipConnectLinkedinOnboardingStep(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ): Promise<OnboardingStepSuccess> {
    await this.onboardingService.setOnboardingConnectLinkedinPending({
      userId: user.id,
      workspaceId: workspace.id,
      value: false,
    });
    await this.onboardingService.setOnboardingConnectAccountPending({
      userId: user.id,
      workspaceId: workspace.id,
      value: true,
    });

    return { success: true };
  }

  @Mutation(() => OnboardingStepSuccess)
  async skipInstallAppOnboardingStep(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ): Promise<OnboardingStepSuccess> {
    await this.onboardingService.setOnboardingConnectAccountPending({
      userId: user.id,
      workspaceId: workspace.id,
      value: true,
    });

    return { success: true };
  }

  @Mutation(() => OnboardingStepSuccess)
  async skipSyncEmailOnboardingStep(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ): Promise<OnboardingStepSuccess> {
    await this.onboardingService.setOnboardingConnectAccountPending({
      userId: user.id,
      workspaceId: workspace.id,
      value: false,
    });

    return { success: true };
  }
}
