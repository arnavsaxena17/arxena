import { UseFilters, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GraphQLError } from 'graphql';

import { AdminPanelHealthService } from 'src/engine/core-modules/admin-panel/admin-panel-health.service';
import { AdminPanelService } from 'src/engine/core-modules/admin-panel/admin-panel.service';
import { EnvironmentVariablesOutput } from 'src/engine/core-modules/admin-panel/dtos/environment-variables.output';
import { ImpersonateInput } from 'src/engine/core-modules/admin-panel/dtos/impersonate.input';
import { ImpersonateOutput } from 'src/engine/core-modules/admin-panel/dtos/impersonate.output';
import { SystemHealth } from 'src/engine/core-modules/admin-panel/dtos/system-health.dto';
import { UpdateWorkspaceFeatureFlagInput } from 'src/engine/core-modules/admin-panel/dtos/update-workspace-feature-flag.input';
import { UserLookup } from 'src/engine/core-modules/admin-panel/dtos/user-lookup.entity';
import { UserLookupInput } from 'src/engine/core-modules/admin-panel/dtos/user-lookup.input';
import { AuthGraphqlApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-graphql-api-exception.filter';
import { WorkspaceService } from 'src/engine/core-modules/workspace/services/workspace.service';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { ImpersonateGuard } from 'src/engine/guards/impersonate-guard';
import { UserAuthGuard } from 'src/engine/guards/user-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

import { AdminPanelHealthServiceData } from './dtos/admin-panel-health-service-data.dto';
import { AdminPanelIndicatorHealthStatusInputEnum } from './dtos/admin-panel-indicator-health-status.input';

@Resolver()
@UseFilters(AuthGraphqlApiExceptionFilter)
export class AdminPanelResolver {
  constructor(
    private adminService: AdminPanelService,
    private adminPanelHealthService: AdminPanelHealthService,
    private readonly workspaceService: WorkspaceService,
  ) {}

  @UseGuards(WorkspaceAuthGuard, UserAuthGuard, ImpersonateGuard)
  @Mutation(() => ImpersonateOutput)
  async impersonate(
    @Args() { workspaceId, userId }: ImpersonateInput,
  ): Promise<ImpersonateOutput> {
    return await this.adminService.impersonate(userId, workspaceId);
  }

  @UseGuards(WorkspaceAuthGuard, UserAuthGuard, ImpersonateGuard)
  @Mutation(() => UserLookup)
  async userLookupAdminPanel(
    @Args() userLookupInput: UserLookupInput,
  ): Promise<UserLookup> {
    return await this.adminService.userLookup(userLookupInput.userIdentifier);
  }

  @UseGuards(WorkspaceAuthGuard, UserAuthGuard, ImpersonateGuard)
  @Mutation(() => Boolean)
  async updateWorkspaceFeatureFlag(
    @Args() updateFlagInput: UpdateWorkspaceFeatureFlagInput,
  ): Promise<boolean> {
    await this.adminService.updateWorkspaceFeatureFlags(
      updateFlagInput.workspaceId,
      updateFlagInput.featureFlag,
      updateFlagInput.value,
    );

    return true;
  }

  @UseGuards(WorkspaceAuthGuard, UserAuthGuard, ImpersonateGuard)
  @Mutation(() => Boolean)
  async adminDeleteWorkspace(
    @AuthWorkspace() workspace: Workspace,
    @Args('workspaceId') workspaceId: string,
  ): Promise<boolean> {
    if (workspace.id === workspaceId) {
      throw new GraphQLError(
        'Cannot delete the workspace you are currently signed into',
      );
    }

    await this.workspaceService.deleteWorkspace(workspaceId);

    return true;
  }

  @UseGuards(WorkspaceAuthGuard, UserAuthGuard, ImpersonateGuard)
  @Query(() => EnvironmentVariablesOutput)
  async getEnvironmentVariablesGrouped(): Promise<EnvironmentVariablesOutput> {
    return this.adminService.getEnvironmentVariablesGrouped();
  }

  @UseGuards(WorkspaceAuthGuard, UserAuthGuard, ImpersonateGuard)
  @Query(() => SystemHealth)
  async getSystemHealthStatus(): Promise<SystemHealth> {
    return this.adminPanelHealthService.getSystemHealthStatus();
  }

  @Query(() => AdminPanelHealthServiceData)
  async getIndicatorHealthStatus(
    @Args('indicatorName', {
      type: () => AdminPanelIndicatorHealthStatusInputEnum,
    })
    indicatorName: AdminPanelIndicatorHealthStatusInputEnum,
  ): Promise<AdminPanelHealthServiceData> {
    return this.adminPanelHealthService.getIndicatorHealthStatus(indicatorName);
  }
}
