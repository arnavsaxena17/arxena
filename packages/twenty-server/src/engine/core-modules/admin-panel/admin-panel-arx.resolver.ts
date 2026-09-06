import { UseFilters, UseGuards, UsePipes } from '@nestjs/common';
import { Args, Context, Mutation, Query } from '@nestjs/graphql';
import { InjectRepository } from '@nestjs/typeorm';

import {
  AI_CREDIT_MICRO_FACTOR,
  PermissionFlagType,
} from 'twenty-shared/constants';
import { IsNull, type Repository } from 'typeorm';

import { AdminResolver } from 'src/engine/api/graphql/graphql-config/decorators/admin-resolver.decorator';
import { AdminPanelArxService } from 'src/engine/core-modules/admin-panel/services/admin-panel-arx.service';
import { AddAdminPublishedOrgChartAliasInput } from 'src/engine/core-modules/admin-panel/dtos/add-admin-published-org-chart-alias.input';
import { AdminConnectMemberLinkedinUnipileOutput } from 'src/engine/core-modules/admin-panel/dtos/admin-connect-member-linkedin-unipile.output';
import { AdminGrantOrgChartToWorkspaceInput } from 'src/engine/core-modules/admin-panel/dtos/admin-grant-org-chart-to-workspace.input';
import {
  AdminGrantOrgChartToWorkspaceOutput,
  AdminOrgChartArtifactOutput,
} from 'src/engine/core-modules/admin-panel/dtos/admin-grant-org-chart-to-workspace.output';
import { AdminLinkedinParameterCacheEntry } from 'src/engine/core-modules/admin-panel/dtos/admin-linkedin-parameter-cache-entry.output';
import { AdminPanelWorkspaceMemberRow } from 'src/engine/core-modules/admin-panel/dtos/admin-panel-workspace-member-row.output';
import { AdminPublishedOrgChart } from 'src/engine/core-modules/admin-panel/dtos/admin-published-org-chart.output';
import { AdminValidateMemberLinkedinStoredCookiesOutput } from 'src/engine/core-modules/admin-panel/dtos/admin-validate-member-linkedin-stored-cookies.output';
import { RebuildAdminPublishedOrgChartInput } from 'src/engine/core-modules/admin-panel/dtos/rebuild-admin-published-org-chart.input';
import { RenameAdminPublishedOrgChartSlugInput } from 'src/engine/core-modules/admin-panel/dtos/rename-admin-published-org-chart-slug.input';
import { UpdateAdminPublishedOrgChartInput } from 'src/engine/core-modules/admin-panel/dtos/update-admin-published-org-chart.input';
import { UpsertOrgChartClientIpRuleInput } from 'src/engine/core-modules/admin-panel/dtos/upsert-org-chart-client-ip-rule.input';
import {
  LinkedInUnipileHealthStatus,
  LinkedInUnipileSessionStats,
} from 'src/engine/core-modules/arx-chat/dtos/linkedin-unipile-monitoring.dto';
import { LinkedInUnipileMonitoringService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-monitoring.service';
import { WhatsAppMonitoringUnifiedService } from 'src/engine/core-modules/arx-chat/services/whatsapp-monitoring-unified.service';
import { AuthGraphqlApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-graphql-api-exception.filter';
import { AdminAdjustWorkspaceCreditsInput } from 'src/engine/core-modules/billing/dtos/inputs/admin-adjust-workspace-credits.input';
import { AdminSetCreditFulfillmentModeInput } from 'src/engine/core-modules/billing/dtos/inputs/admin-set-credit-fulfillment-mode.input';
import { AdminWorkspaceCreditsRowOutput } from 'src/engine/core-modules/billing/dtos/outputs/admin-workspace-credits-row.output';
import { BillingCustomerEntity } from 'src/engine/core-modules/billing/entities/billing-customer.entity';
import { WorkspaceCredits } from 'src/engine/core-modules/billing/entities/workspace-credits.entity';
import { CreditFulfillmentMode } from 'src/engine/core-modules/billing/enums/credit-fulfillment-mode.enum';
import { EntitlementFulfillmentService } from 'src/engine/core-modules/billing/services/entitlement-fulfillment.service';
import { WorkspaceCreditsService } from 'src/engine/core-modules/billing/services/workspace-credits.service';
import { LinkedinParameterResolver } from 'src/engine/core-modules/candidate-search/utils/linkedin-parameter-resolver.util';
import { PreventNestToAutoLogGraphqlErrorsFilter } from 'src/engine/core-modules/graphql/filters/prevent-nest-to-auto-log-graphql-errors.filter';
import { ResolverValidationPipe } from 'src/engine/core-modules/graphql/pipes/resolver-validation.pipe';
import { UserInputError } from 'src/engine/core-modules/graphql/utils/graphql-errors.util';
import { OrgChartClientIpRuleEntity } from 'src/engine/core-modules/org-chart/org-chart-client-ip-rule.entity';
import { OrgChartClientIpService } from 'src/engine/core-modules/org-chart/services/org-chart-client-ip.service';
import { OrgChartGrantAdminService } from 'src/engine/core-modules/org-chart/services/org-chart-grant-admin.service';
import { OrgChartPublishedAdminService } from 'src/engine/core-modules/org-chart/services/org-chart-published-admin.service';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { WhatsAppHealthStatus } from 'src/engine/core-modules/whiskeysocket-baileys/dtos/whatsapp-health-status.dto';
import { WhatsAppSessionStats } from 'src/engine/core-modules/whiskeysocket-baileys/dtos/whatsapp-session-stats.dto';
import { WhatsAppSessions } from 'src/engine/core-modules/whiskeysocket-baileys/dtos/whatsapp-sessions.dto';
import { WorkspaceService } from 'src/engine/core-modules/workspace/services/workspace.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { AdminPanelGuard } from 'src/engine/guards/admin-panel-guard';
import { SettingsPermissionGuard } from 'src/engine/guards/settings-permission.guard';
import { UserAuthGuard } from 'src/engine/guards/user-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';

type AdminWorkspaceCreatorEmailRow = {
  workspaceId: string;
  email: string;
};

@UsePipes(ResolverValidationPipe)
@AdminResolver()
@UseFilters(
  AuthGraphqlApiExceptionFilter,
  PreventNestToAutoLogGraphqlErrorsFilter,
)
@UseGuards(
  WorkspaceAuthGuard,
  UserAuthGuard,
  SettingsPermissionGuard(PermissionFlagType.SECURITY),
)
export class AdminPanelArxResolver {
  constructor(
    private readonly adminPanelArxService: AdminPanelArxService,
    private readonly orgChartPublishedAdminService: OrgChartPublishedAdminService,
    private readonly orgChartGrantAdminService: OrgChartGrantAdminService,
    private readonly orgChartClientIpService: OrgChartClientIpService,
    private readonly linkedinParameterResolver: LinkedinParameterResolver,
    private readonly workspaceCreditsService: WorkspaceCreditsService,
    private readonly entitlementFulfillmentService: EntitlementFulfillmentService,
    private readonly workspaceService: WorkspaceService,
    private readonly whatsAppMonitoringUnifiedService: WhatsAppMonitoringUnifiedService,
    private readonly linkedInUnipileMonitoringService: LinkedInUnipileMonitoringService,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectRepository(UserWorkspaceEntity)
    private readonly userWorkspaceRepository: Repository<UserWorkspaceEntity>,
    @InjectRepository(WorkspaceCredits)
    private readonly workspaceCreditsRepository: Repository<WorkspaceCredits>,
    @InjectRepository(BillingCustomerEntity)
    private readonly billingCustomerRepository: Repository<BillingCustomerEntity>,
  ) {}

  @UseGuards(AdminPanelGuard)
  @Query(() => [AdminPanelWorkspaceMemberRow])
  async adminPanelAllWorkspaceMembers(): Promise<
    AdminPanelWorkspaceMemberRow[]
  > {
    return this.adminPanelArxService.listAllWorkspaceMembersForAdminPanel();
  }

  @UseGuards(AdminPanelGuard)
  @Mutation(() => AdminValidateMemberLinkedinStoredCookiesOutput)
  async adminValidateMemberLinkedinStoredCookies(
    @Args('workspaceId') workspaceId: string,
    @Args('workspaceMemberId') workspaceMemberId: string,
  ): Promise<AdminValidateMemberLinkedinStoredCookiesOutput> {
    return this.adminPanelArxService.validateMemberLinkedinStoredCookies(
      workspaceId,
      workspaceMemberId,
    );
  }

  @UseGuards(AdminPanelGuard)
  @Mutation(() => AdminConnectMemberLinkedinUnipileOutput)
  async adminConnectMemberLinkedinUnipile(
    @Args('workspaceId') workspaceId: string,
    @Args('workspaceMemberId') workspaceMemberId: string,
  ): Promise<AdminConnectMemberLinkedinUnipileOutput> {
    return this.adminPanelArxService.connectMemberLinkedinUnipile(
      workspaceId,
      workspaceMemberId,
    );
  }

  @UseGuards(AdminPanelGuard)
  @Query(() => [AdminPublishedOrgChart])
  async adminPublishedOrgCharts(): Promise<AdminPublishedOrgChart[]> {
    return this.orgChartPublishedAdminService.listPublishedOrgCharts();
  }

  @UseGuards(AdminPanelGuard)
  @Query(() => AdminOrgChartArtifactOutput)
  async adminOrgChartArtifact(
    @Args('companyId') companyId: string,
  ): Promise<AdminOrgChartArtifactOutput> {
    return this.orgChartGrantAdminService.lookupOrgChartArtifact(companyId);
  }

  @UseGuards(AdminPanelGuard)
  @Mutation(() => AdminGrantOrgChartToWorkspaceOutput)
  async adminGrantOrgChartToWorkspace(
    @Args('input') input: AdminGrantOrgChartToWorkspaceInput,
  ): Promise<AdminGrantOrgChartToWorkspaceOutput> {
    return this.orgChartGrantAdminService.grantOrgChartToWorkspace(input);
  }

  @UseGuards(AdminPanelGuard)
  @Mutation(() => AdminPublishedOrgChart)
  async rebuildAdminPublishedOrgChart(
    @Args('input') input: RebuildAdminPublishedOrgChartInput,
    @Context() context: { req: { headers?: { authorization?: string } } },
  ): Promise<AdminPublishedOrgChart> {
    const apiToken = this.extractBearerToken(context.req);

    return this.orgChartPublishedAdminService.rebuildPublishedOrgChart({
      publishSlug: input.publishSlug,
      apiToken,
    });
  }

  @UseGuards(AdminPanelGuard)
  @Mutation(() => AdminPublishedOrgChart)
  async updateAdminPublishedOrgChart(
    @Args('input') input: UpdateAdminPublishedOrgChartInput,
  ): Promise<AdminPublishedOrgChart> {
    return this.orgChartPublishedAdminService.updatePublishedOrgChart(input);
  }

  @UseGuards(AdminPanelGuard)
  @Mutation(() => AdminPublishedOrgChart)
  async addAdminPublishedOrgChartAlias(
    @Args('input') input: AddAdminPublishedOrgChartAliasInput,
  ): Promise<AdminPublishedOrgChart> {
    return this.orgChartPublishedAdminService.addPublishedOrgChartAlias({
      sourcePublishSlug: input.sourcePublishSlug,
      newPublishSlug: input.newPublishSlug,
    });
  }

  @UseGuards(AdminPanelGuard)
  @Mutation(() => AdminPublishedOrgChart)
  async renameAdminPublishedOrgChartSlug(
    @Args('input') input: RenameAdminPublishedOrgChartSlugInput,
  ): Promise<AdminPublishedOrgChart> {
    return this.orgChartPublishedAdminService.renamePublishedOrgChartSlug({
      publishSlug: input.publishSlug,
      newPublishSlug: input.newPublishSlug,
    });
  }

  @UseGuards(AdminPanelGuard)
  @Mutation(() => Boolean)
  async deleteAdminPublishedOrgChartSlug(
    @Args('publishSlug') publishSlug: string,
  ): Promise<boolean> {
    return this.orgChartPublishedAdminService.deletePublishedOrgChartSlug(
      publishSlug,
    );
  }

  @UseGuards(AdminPanelGuard)
  @Query(() => [OrgChartClientIpRuleEntity])
  async orgChartClientIpRules(): Promise<OrgChartClientIpRuleEntity[]> {
    return this.orgChartClientIpService.listRules();
  }

  @UseGuards(AdminPanelGuard)
  @Mutation(() => OrgChartClientIpRuleEntity)
  async upsertOrgChartClientIpRule(
    @Args('input') input: UpsertOrgChartClientIpRuleInput,
  ): Promise<OrgChartClientIpRuleEntity> {
    return this.orgChartClientIpService.upsertRule(input);
  }

  @UseGuards(AdminPanelGuard)
  @Mutation(() => Boolean)
  async deleteOrgChartClientIpRule(@Args('id') id: string): Promise<boolean> {
    return this.orgChartClientIpService.deleteRule(id);
  }

  @UseGuards(AdminPanelGuard)
  @Mutation(() => Boolean)
  async resetOrgChartClientIpRuleCounters(
    @Args('id') id: string,
  ): Promise<boolean> {
    return this.orgChartClientIpService.resetCounters(id);
  }

  @UseGuards(AdminPanelGuard)
  @Query(() => [AdminLinkedinParameterCacheEntry])
  adminLinkedinParameterCacheEntries(): AdminLinkedinParameterCacheEntry[] {
    return this.linkedinParameterResolver.listCacheEntries();
  }

  @UseGuards(AdminPanelGuard)
  @Mutation(() => Boolean)
  adminDeleteLinkedinParameterCacheEntry(
    @Args('cacheKey') cacheKey: string,
  ): boolean {
    return this.linkedinParameterResolver.deleteCacheEntry(cacheKey);
  }

  @UseGuards(AdminPanelGuard)
  @Mutation(() => Number)
  adminClearLinkedinParameterCache(): number {
    return this.linkedinParameterResolver.clearCache();
  }

  @UseGuards(AdminPanelGuard)
  @Query(() => [AdminWorkspaceCreditsRowOutput])
  async adminListWorkspacesWithCredits(): Promise<
    AdminWorkspaceCreditsRowOutput[]
  > {
    const workspaces = await this.workspaceRepository.find({
      select: ['id', 'displayName', 'createdAt'],
      where: { deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    const creatorRows = await this.userWorkspaceRepository
      .createQueryBuilder('userWorkspace')
      .innerJoin('userWorkspace.user', 'user')
      .select('userWorkspace.workspaceId', 'workspaceId')
      .addSelect('user.email', 'email')
      .where('userWorkspace.deletedAt IS NULL')
      .andWhere('user.deletedAt IS NULL')
      .distinctOn(['userWorkspace.workspaceId'])
      .orderBy('userWorkspace.workspaceId', 'ASC')
      .addOrderBy('userWorkspace.createdAt', 'ASC')
      .getRawMany<AdminWorkspaceCreatorEmailRow>();
    const creatorEmailByWorkspaceId = new Map<string, string>(
      creatorRows.map((row) => [row.workspaceId, row.email]),
    );
    const creditsRows = await this.workspaceCreditsRepository.find();
    const creditsByWorkspaceId = new Map<string, WorkspaceCredits>(
      creditsRows.map((row) => [row.workspaceId, row]),
    );
    const billingCustomers = await this.billingCustomerRepository.find({
      select: ['workspaceId', 'creditBalanceMicro'],
    });
    const aiCreditsByWorkspaceId = new Map<string, number>(
      billingCustomers.map((customer) => [
        customer.workspaceId,
        Math.max(
          0,
          Math.round(customer.creditBalanceMicro / AI_CREDIT_MICRO_FACTOR),
        ),
      ]),
    );

    return workspaces.map((workspace): AdminWorkspaceCreditsRowOutput => {
      const credits = creditsByWorkspaceId.get(workspace.id);

      return {
        workspaceId: workspace.id,
        workspaceCreatedAt: workspace.createdAt,
        workspaceName: workspace.displayName ?? '',
        workspaceCreatorEmail:
          creatorEmailByWorkspaceId.get(workspace.id) ?? null,
        orgChartCredits: credits?.orgChartCredits ?? 0,
        revealCredits: credits?.revealCredits ?? 0,
        apiCredits: credits?.apiCredits ?? 0,
        aiCredits: aiCreditsByWorkspaceId.get(workspace.id) ?? 0,
      };
    });
  }

  @UseGuards(AdminPanelGuard)
  @Mutation(() => Boolean)
  async adminAdjustWorkspaceCredits(
    @Args('input', { type: () => AdminAdjustWorkspaceCreditsInput })
    input: AdminAdjustWorkspaceCreditsInput,
  ): Promise<boolean> {
    await this.workspaceCreditsService.adjustCredits(
      input.workspaceId,
      input.creditType as 'org_chart' | 'reveal' | 'ai' | 'api',
      input.delta,
    );

    return true;
  }

  @UseGuards(AdminPanelGuard)
  @Mutation(() => Boolean)
  async adminSetCreditFulfillmentMode(
    @Args('input', { type: () => AdminSetCreditFulfillmentModeInput })
    input: AdminSetCreditFulfillmentModeInput,
  ): Promise<boolean> {
    await this.entitlementFulfillmentService.setFulfillmentMode(
      input.workspaceId,
      input.mode,
    );

    return true;
  }

  @UseGuards(AdminPanelGuard)
  @Query(() => CreditFulfillmentMode)
  async adminGetCreditFulfillmentMode(
    @Args('workspaceId') workspaceId: string,
  ): Promise<CreditFulfillmentMode> {
    return this.entitlementFulfillmentService.getFulfillmentMode(workspaceId);
  }

  @UseGuards(AdminPanelGuard)
  @Mutation(() => Boolean)
  async adminDeleteWorkspace(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Args('workspaceId') workspaceId: string,
  ): Promise<boolean> {
    if (workspace.id === workspaceId) {
      throw new UserInputError(
        'Cannot delete the workspace you are currently signed into',
      );
    }

    await this.workspaceService.deleteWorkspace(workspaceId);

    return true;
  }

  @UseGuards(AdminPanelGuard)
  @Query(() => WhatsAppHealthStatus)
  async getWhatsAppHealthStatus(
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<WhatsAppHealthStatus> {
    return this.whatsAppMonitoringUnifiedService.getWhatsAppHealthStatus(
      workspace,
    );
  }

  @UseGuards(AdminPanelGuard)
  @Query(() => WhatsAppSessionStats)
  async getWhatsAppSessionStats(
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<WhatsAppSessionStats> {
    return this.whatsAppMonitoringUnifiedService.getWhatsAppSessionStats(
      workspace,
    );
  }

  @UseGuards(AdminPanelGuard)
  @Query(() => WhatsAppSessions)
  async getWhatsAppSessions(
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<WhatsAppSessions> {
    return this.whatsAppMonitoringUnifiedService.getWhatsAppSessions(workspace);
  }

  @UseGuards(AdminPanelGuard)
  @Query(() => LinkedInUnipileHealthStatus)
  async getLinkedInUnipileHealthStatus(
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<LinkedInUnipileHealthStatus> {
    return this.linkedInUnipileMonitoringService.getLinkedInUnipileHealthStatus(
      workspace,
    );
  }

  @UseGuards(AdminPanelGuard)
  @Query(() => LinkedInUnipileSessionStats)
  async getLinkedInUnipileSessionStats(
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<LinkedInUnipileSessionStats> {
    return this.linkedInUnipileMonitoringService.getLinkedInUnipileSessionStats(
      workspace,
    );
  }

  private extractBearerToken(req: {
    headers?: { authorization?: string };
  }): string {
    const header = req.headers?.authorization ?? '';
    const match = /^Bearer\s+(.+)$/i.exec(header);

    if (!match?.[1]) {
      throw new UserInputError('Missing Authorization bearer token');
    }

    return match[1];
  }
}
