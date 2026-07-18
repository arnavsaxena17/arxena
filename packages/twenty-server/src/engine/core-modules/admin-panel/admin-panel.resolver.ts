import { UseFilters, UseGuards } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';

import { GraphQLError } from 'graphql';
import { Request } from 'express';

import { AdminLinkedinParameterCacheEntry } from 'src/engine/core-modules/admin-panel/dtos/admin-linkedin-parameter-cache-entry.output';
import { AdminPanelHealthService } from 'src/engine/core-modules/admin-panel/admin-panel-health.service';
import { AdminPanelService } from 'src/engine/core-modules/admin-panel/admin-panel.service';
import { AdminPanelWorkspaceMemberRow } from 'src/engine/core-modules/admin-panel/dtos/admin-panel-workspace-member-row.output';
import { AdminConnectMemberLinkedinUnipileOutput } from 'src/engine/core-modules/admin-panel/dtos/admin-connect-member-linkedin-unipile.output';
import { AdminValidateMemberLinkedinStoredCookiesOutput } from 'src/engine/core-modules/admin-panel/dtos/admin-validate-member-linkedin-stored-cookies.output';
import { EnvironmentVariablesOutput } from 'src/engine/core-modules/admin-panel/dtos/environment-variables.output';
import { ImpersonateInput } from 'src/engine/core-modules/admin-panel/dtos/impersonate.input';
import { ImpersonateOutput } from 'src/engine/core-modules/admin-panel/dtos/impersonate.output';
import { SystemHealth } from 'src/engine/core-modules/admin-panel/dtos/system-health.dto';
import { UpdateWorkspaceFeatureFlagInput } from 'src/engine/core-modules/admin-panel/dtos/update-workspace-feature-flag.input';
import { AdminPublishedOrgChart } from 'src/engine/core-modules/admin-panel/dtos/admin-published-org-chart.output';
import { AddAdminPublishedOrgChartAliasInput } from 'src/engine/core-modules/admin-panel/dtos/add-admin-published-org-chart-alias.input';
import { RebuildAdminPublishedOrgChartInput } from 'src/engine/core-modules/admin-panel/dtos/rebuild-admin-published-org-chart.input';
import { RenameAdminPublishedOrgChartSlugInput } from 'src/engine/core-modules/admin-panel/dtos/rename-admin-published-org-chart-slug.input';
import { UpdateAdminPublishedOrgChartInput } from 'src/engine/core-modules/admin-panel/dtos/update-admin-published-org-chart.input';
import { UpsertOrgChartClientIpRuleInput } from 'src/engine/core-modules/admin-panel/dtos/upsert-org-chart-client-ip-rule.input';
import { UserLookup } from 'src/engine/core-modules/admin-panel/dtos/user-lookup.entity';
import { UserLookupInput } from 'src/engine/core-modules/admin-panel/dtos/user-lookup.input';
import { AuthGraphqlApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-graphql-api-exception.filter';
import { LinkedinParameterResolver } from 'src/engine/core-modules/candidate-search/utils/linkedin-parameter-resolver.util';
import { OrgChartClientIpRuleEntity } from 'src/engine/core-modules/org-chart/org-chart-client-ip-rule.entity';
import { OrgChartClientIpService } from 'src/engine/core-modules/org-chart/services/org-chart-client-ip.service';
import { OrgChartPublishedAdminService } from 'src/engine/core-modules/org-chart/services/org-chart-published-admin.service';
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
    private readonly orgChartClientIpService: OrgChartClientIpService,
    private readonly orgChartPublishedAdminService: OrgChartPublishedAdminService,
    private readonly linkedinParameterResolver: LinkedinParameterResolver,
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
  @Query(() => [AdminPublishedOrgChart])
  async adminPublishedOrgCharts(): Promise<AdminPublishedOrgChart[]> {
    return this.orgChartPublishedAdminService.listPublishedOrgCharts();
  }

  @UseGuards(WorkspaceAuthGuard, UserAuthGuard, ImpersonateGuard)
  @Mutation(() => AdminPublishedOrgChart)
  async rebuildAdminPublishedOrgChart(
    @Args('input') input: RebuildAdminPublishedOrgChartInput,
    @Context() context: { req: Request },
  ): Promise<AdminPublishedOrgChart> {
    const apiToken = this.extractBearerToken(context.req);

    return this.orgChartPublishedAdminService.rebuildPublishedOrgChart({
      publishSlug: input.publishSlug,
      apiToken,
    });
  }

  @UseGuards(WorkspaceAuthGuard, UserAuthGuard, ImpersonateGuard)
  @Mutation(() => AdminPublishedOrgChart)
  async updateAdminPublishedOrgChart(
    @Args('input') input: UpdateAdminPublishedOrgChartInput,
  ): Promise<AdminPublishedOrgChart> {
    return this.orgChartPublishedAdminService.updatePublishedOrgChart(input);
  }

  @UseGuards(WorkspaceAuthGuard, UserAuthGuard, ImpersonateGuard)
  @Mutation(() => AdminPublishedOrgChart)
  async addAdminPublishedOrgChartAlias(
    @Args('input') input: AddAdminPublishedOrgChartAliasInput,
  ): Promise<AdminPublishedOrgChart> {
    return this.orgChartPublishedAdminService.addPublishedOrgChartAlias({
      sourcePublishSlug: input.sourcePublishSlug,
      newPublishSlug: input.newPublishSlug,
    });
  }

  @UseGuards(WorkspaceAuthGuard, UserAuthGuard, ImpersonateGuard)
  @Mutation(() => AdminPublishedOrgChart)
  async renameAdminPublishedOrgChartSlug(
    @Args('input') input: RenameAdminPublishedOrgChartSlugInput,
  ): Promise<AdminPublishedOrgChart> {
    return this.orgChartPublishedAdminService.renamePublishedOrgChartSlug({
      publishSlug: input.publishSlug,
      newPublishSlug: input.newPublishSlug,
    });
  }

  @UseGuards(WorkspaceAuthGuard, UserAuthGuard, ImpersonateGuard)
  @Mutation(() => Boolean)
  async deleteAdminPublishedOrgChartSlug(
    @Args('publishSlug') publishSlug: string,
  ): Promise<boolean> {
    return this.orgChartPublishedAdminService.deletePublishedOrgChartSlug(
      publishSlug,
    );
  }

  @UseGuards(WorkspaceAuthGuard, UserAuthGuard, ImpersonateGuard)
  @Query(() => [OrgChartClientIpRuleEntity])
  async orgChartClientIpRules(): Promise<OrgChartClientIpRuleEntity[]> {
    return this.orgChartClientIpService.listRules();
  }

  @UseGuards(WorkspaceAuthGuard, UserAuthGuard, ImpersonateGuard)
  @Mutation(() => OrgChartClientIpRuleEntity)
  async upsertOrgChartClientIpRule(
    @Args('input') input: UpsertOrgChartClientIpRuleInput,
  ): Promise<OrgChartClientIpRuleEntity> {
    return this.orgChartClientIpService.upsertRule(input);
  }

  @UseGuards(WorkspaceAuthGuard, UserAuthGuard, ImpersonateGuard)
  @Mutation(() => Boolean)
  async deleteOrgChartClientIpRule(@Args('id') id: string): Promise<boolean> {
    return this.orgChartClientIpService.deleteRule(id);
  }

  @UseGuards(WorkspaceAuthGuard, UserAuthGuard, ImpersonateGuard)
  @Mutation(() => Boolean)
  async resetOrgChartClientIpRuleCounters(
    @Args('id') id: string,
  ): Promise<boolean> {
    return this.orgChartClientIpService.resetCounters(id);
  }

  @UseGuards(WorkspaceAuthGuard, UserAuthGuard, ImpersonateGuard)
  @Query(() => [AdminLinkedinParameterCacheEntry])
  adminLinkedinParameterCacheEntries(): AdminLinkedinParameterCacheEntry[] {
    return this.linkedinParameterResolver.listCacheEntries();
  }

  @UseGuards(WorkspaceAuthGuard, UserAuthGuard, ImpersonateGuard)
  @Mutation(() => Boolean)
  adminDeleteLinkedinParameterCacheEntry(
    @Args('cacheKey') cacheKey: string,
  ): boolean {
    return this.linkedinParameterResolver.deleteCacheEntry(cacheKey);
  }

  @UseGuards(WorkspaceAuthGuard, UserAuthGuard, ImpersonateGuard)
  @Mutation(() => Number)
  adminClearLinkedinParameterCache(): number {
    return this.linkedinParameterResolver.clearCache();
  }

  @UseGuards(WorkspaceAuthGuard, UserAuthGuard, ImpersonateGuard)
  @Query(() => [AdminPanelWorkspaceMemberRow])
  async adminPanelAllWorkspaceMembers(): Promise<
    AdminPanelWorkspaceMemberRow[]
  > {
    return this.adminService.listAllWorkspaceMembersForAdminPanel();
  }

  @UseGuards(WorkspaceAuthGuard, UserAuthGuard, ImpersonateGuard)
  @Mutation(() => AdminValidateMemberLinkedinStoredCookiesOutput)
  async adminValidateMemberLinkedinStoredCookies(
    @Args('workspaceId') workspaceId: string,
    @Args('workspaceMemberId') workspaceMemberId: string,
  ): Promise<AdminValidateMemberLinkedinStoredCookiesOutput> {
    return this.adminService.validateMemberLinkedinStoredCookies(
      workspaceId,
      workspaceMemberId,
    );
  }

  @UseGuards(WorkspaceAuthGuard, UserAuthGuard, ImpersonateGuard)
  @Mutation(() => AdminConnectMemberLinkedinUnipileOutput)
  async adminConnectMemberLinkedinUnipile(
    @Args('workspaceId') workspaceId: string,
    @Args('workspaceMemberId') workspaceMemberId: string,
  ): Promise<AdminConnectMemberLinkedinUnipileOutput> {
    return this.adminService.connectMemberLinkedinUnipile(
      workspaceId,
      workspaceMemberId,
    );
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

  private extractBearerToken(req: Request): string {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new GraphQLError('Authentication required');
    }

    const token = authHeader.slice('Bearer '.length).trim();

    if (!token) {
      throw new GraphQLError('Authentication required');
    }

    return token;
  }
}
