/* @license Enterprise */

import { UseFilters, UseGuards } from '@nestjs/common';
import { Args, Context, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';

import { GraphQLError } from 'graphql';
import { getRevealCost, SettingsFeatures } from 'twenty-shared';
import { Repository } from 'typeorm';

import { AdminAdjustWorkspaceCreditsInput } from 'src/engine/core-modules/billing/dtos/inputs/admin-adjust-workspace-credits.input';
import { BillingCheckoutSessionInput } from 'src/engine/core-modules/billing/dtos/inputs/billing-checkout-session.input';
import { BillingProductInput } from 'src/engine/core-modules/billing/dtos/inputs/billing-product.input';
import { BillingSessionInput } from 'src/engine/core-modules/billing/dtos/inputs/billing-session.input';
import { CreateRazorpayOrderInput } from 'src/engine/core-modules/billing/dtos/inputs/create-razorpay-order.input';
import { RequestInvoiceForCreditsInput } from 'src/engine/core-modules/billing/dtos/inputs/request-invoice-for-credits.input';
import { AdminWorkspaceCreditsRowOutput } from 'src/engine/core-modules/billing/dtos/outputs/admin-workspace-credits-row.output';
import { BillingPlanOutput } from 'src/engine/core-modules/billing/dtos/outputs/billing-plan.output';
import { BillingProductPricesOutput } from 'src/engine/core-modules/billing/dtos/outputs/billing-product-prices.output';
import {
    BillingProviderEnum,
    BillingProviderOutput,
} from 'src/engine/core-modules/billing/dtos/outputs/billing-provider.output';
import { BillingSessionOutput } from 'src/engine/core-modules/billing/dtos/outputs/billing-session.output';
import { BillingUpdateOutput } from 'src/engine/core-modules/billing/dtos/outputs/billing-update.output';
import { CreditPackOutput } from 'src/engine/core-modules/billing/dtos/outputs/credit-pack.output';
import { CreditTransactionsOutput } from 'src/engine/core-modules/billing/dtos/outputs/credit-transaction.output';
import { EngagementPlanOutput } from 'src/engine/core-modules/billing/dtos/outputs/engagement-plan.output';
import { RazorpayOrderOutput } from 'src/engine/core-modules/billing/dtos/outputs/razorpay-order.output';
import { RequestInvoiceForCreditsOutput } from 'src/engine/core-modules/billing/dtos/outputs/request-invoice-for-credits.output';
import { WorkspaceCreditsOutput } from 'src/engine/core-modules/billing/dtos/outputs/workspace-credits.output';
import { BillingPrice } from 'src/engine/core-modules/billing/entities/billing-price.entity';
import { WorkspaceCredits } from 'src/engine/core-modules/billing/entities/workspace-credits.entity';
import { AvailableProduct } from 'src/engine/core-modules/billing/enums/billing-available-product.enum';
import { BillingPlanKey } from 'src/engine/core-modules/billing/enums/billing-plan-key.enum';
import { SubscriptionInterval } from 'src/engine/core-modules/billing/enums/billing-subscription-interval.enum';
import { RAZORPAY_CREDIT_PACKS } from 'src/engine/core-modules/billing/razorpay/constants/credit-packs.constant';
import { RazorpayOrderService } from 'src/engine/core-modules/billing/razorpay/services/razorpay-order.service';
import { RazorpayPlanService } from 'src/engine/core-modules/billing/razorpay/services/razorpay-plan.service';
import { BillingPlanService } from 'src/engine/core-modules/billing/services/billing-plan.service';
import { BillingPortalWorkspaceService } from 'src/engine/core-modules/billing/services/billing-portal.workspace-service';
import { BillingSubscriptionService } from 'src/engine/core-modules/billing/services/billing-subscription.service';
import { CreditTransactionService } from 'src/engine/core-modules/billing/services/credit-transaction.service';
import { InvoiceRequestService } from 'src/engine/core-modules/billing/services/invoice-request.service';
import { PricingCurrencyService } from 'src/engine/core-modules/billing/services/pricing-currency.service';
import { WorkspaceCreditsService } from 'src/engine/core-modules/billing/services/workspace-credits.service';
import { StripePriceService } from 'src/engine/core-modules/billing/stripe/services/stripe-price.service';
import { BillingPortalCheckoutSessionParameters } from 'src/engine/core-modules/billing/types/billing-portal-checkout-session-parameters.type';
import { formatBillingDatabaseProductToGraphqlDTO } from 'src/engine/core-modules/billing/utils/format-database-product-to-graphql-dto.util';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { FeatureFlagKey } from 'src/engine/core-modules/feature-flag/enums/feature-flag-key.enum';
import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { UserWorkspace } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { User } from 'src/engine/core-modules/user/user.entity';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthUser } from 'src/engine/decorators/auth/auth-user.decorator';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { ImpersonateGuard } from 'src/engine/guards/impersonate-guard';
import { SettingsPermissionsGuard } from 'src/engine/guards/settings-permissions.guard';
import { UserAuthGuard } from 'src/engine/guards/user-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { PermissionsGraphqlApiExceptionFilter } from 'src/engine/metadata-modules/permissions/utils/permissions-graphql-api-exception.filter';

type AdminWorkspaceCreatorEmailRow = {
  workspaceId: string;
  email: string;
};

@Resolver()
@UseFilters(PermissionsGraphqlApiExceptionFilter)
export class BillingResolver {
  constructor(
    private readonly creditTransactionService: CreditTransactionService,
    private readonly billingSubscriptionService: BillingSubscriptionService,
    private readonly billingPortalWorkspaceService: BillingPortalWorkspaceService,
    private readonly stripePriceService: StripePriceService,
    private readonly billingPlanService: BillingPlanService,
    private readonly featureFlagService: FeatureFlagService,
    private readonly environmentService: EnvironmentService,
    private readonly razorpayPlanService: RazorpayPlanService,
    private readonly razorpayOrderService: RazorpayOrderService,
    private readonly invoiceRequestService: InvoiceRequestService,
    private readonly pricingCurrencyService: PricingCurrencyService,
    private readonly workspaceCreditsService: WorkspaceCreditsService,
    @InjectRepository(BillingPrice, 'core')
    private readonly billingPriceRepository: Repository<BillingPrice>,
    @InjectRepository(WorkspaceCredits, 'core')
    private readonly workspaceCreditsRepository: Repository<WorkspaceCredits>,
    @InjectRepository(Workspace, 'core')
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(UserWorkspace, 'core')
    private readonly userWorkspaceRepository: Repository<UserWorkspace>,
  ) {}

  @Query(() => BillingProductPricesOutput)
  @UseGuards(WorkspaceAuthGuard)
  async getProductPrices(
    @AuthWorkspace() workspace: Workspace,
    @Args() { product }: BillingProductInput,
  ) {
    const productPrices =
      await this.stripePriceService.getStripePrices(product);

    return {
      totalNumberOfPrices: productPrices.length,
      productPrices,
    };
  }

  @Query(() => BillingSessionOutput)
  @UseGuards(
    WorkspaceAuthGuard,
    SettingsPermissionsGuard(SettingsFeatures.WORKSPACE),
  )
  async billingPortalSession(
    @AuthWorkspace() workspace: Workspace,
    @Args() { returnUrlPath }: BillingSessionInput,
  ) {
    return {
      url: await this.billingPortalWorkspaceService.computeBillingPortalSessionURLOrThrow(
        workspace,
        returnUrlPath,
      ),
    };
  }

  @Mutation(() => BillingSessionOutput)
  @UseGuards(WorkspaceAuthGuard, UserAuthGuard)
  async checkoutSession(
    @AuthWorkspace() workspace: Workspace,
    @AuthUser() user: User,
    @Args()
    {
      recurringInterval,
      successUrlPath,
      successReturnUrl,
      plan,
      requirePaymentMethod,
      razorpayPlanId,
      quantity,
    }: BillingCheckoutSessionInput,
  ) {
    const provider = this.environmentService.get('BILLING_PROVIDER');

    if (provider === 'razorpay') {
      const { subscriptionId, keyId, callbackUrl } =
        await this.billingPortalWorkspaceService.computeRazorpayCheckoutSession(
          {
            workspace,
            successUrlPath: successUrlPath ?? '',
            successReturnUrl,
            razorpayPlanId,
            quantity,
          },
        );

      return {
        url: null,
        razorpaySubscriptionId: subscriptionId,
        razorpayKeyId: keyId,
        razorpayCallbackUrl: callbackUrl,
      };
    }

    const isBillingPlansEnabled =
      await this.featureFlagService.isFeatureEnabled(
        FeatureFlagKey.IsBillingPlansEnabled,
        workspace.id,
      );

    const checkoutSessionParams: BillingPortalCheckoutSessionParameters = {
      user,
      workspace,
      successUrlPath,
      plan: plan ?? BillingPlanKey.PRO,
      requirePaymentMethod,
    };

    if (isBillingPlansEnabled) {
      const billingPricesPerPlan =
        await this.billingPlanService.getPricesPerPlan({
          planKey: checkoutSessionParams.plan,
          interval: recurringInterval,
        });
      const checkoutSessionURL =
        await this.billingPortalWorkspaceService.computeCheckoutSessionURL({
          ...checkoutSessionParams,
          billingPricesPerPlan,
        });

      return {
        url: checkoutSessionURL,
        razorpaySubscriptionId: null,
        razorpayKeyId: null,
        razorpayCallbackUrl: null,
      };
    }

    const productPrice = await this.stripePriceService.getStripePrice(
      AvailableProduct.BasePlan,
      recurringInterval,
    );

    if (!productPrice) {
      throw new GraphQLError(
        'Product price not found for the given recurring interval',
      );
    }
    const checkoutSessionURL =
      await this.billingPortalWorkspaceService.computeCheckoutSessionURL({
        ...checkoutSessionParams,
        priceId: productPrice.stripePriceId,
      });

    return {
      url: checkoutSessionURL,
      razorpaySubscriptionId: null,
      razorpayKeyId: null,
      razorpayCallbackUrl: null,
    };
  }

  @Mutation(() => BillingUpdateOutput)
  @UseGuards(
    WorkspaceAuthGuard,
    SettingsPermissionsGuard(SettingsFeatures.WORKSPACE),
  )
  async updateBillingSubscription(@AuthWorkspace() workspace: Workspace) {
    await this.billingSubscriptionService.applyBillingSubscription(workspace);

    return { success: true };
  }

  @Query(() => [BillingPlanOutput])
  @UseGuards(WorkspaceAuthGuard)
  async plans(): Promise<BillingPlanOutput[]> {
    const plans = await this.billingPlanService.getPlans();

    return plans.map(formatBillingDatabaseProductToGraphqlDTO);
  }

  @Query(() => BillingProviderOutput)
  billingProvider(): BillingProviderOutput {
    const provider = this.environmentService.get('BILLING_PROVIDER');

    return {
      provider:
        provider === 'razorpay'
          ? BillingProviderEnum.razorpay
          : BillingProviderEnum.stripe,
    };
  }

  @Query(() => String)
  async requestPricingCurrency(
    @Context() context: { req: Request },
  ): Promise<string> {
    return this.pricingCurrencyService.getRequestPricingCurrency(
      context.req,
    );
  }

  @Query(() => [CreditPackOutput])
  creditPacks(): CreditPackOutput[] {
    return RAZORPAY_CREDIT_PACKS.map((pack) => ({
      key: pack.key,
      name: pack.name,
      credits: pack.credits,
      amountSubunits: pack.amountSubunits,
      currency: pack.currency,
      planId: pack.planId,
      intent: pack.intent,
      mapsCount: pack.mapsCount,
      mapType: pack.mapType,
      mapTypeLabel: pack.mapTypeLabel,
      tagline: pack.tagline,
      inheritedFromPlanId: pack.inheritedFromPlanId,
      ownFeatures: pack.features,
      includedEmailCredits: pack.includedEmailCredits,
      includedPhoneCredits: pack.includedPhoneCredits,
      creditsDisplay: pack.creditsDisplay,
      pricesSubunitsJson: JSON.stringify(pack.pricesSubunits),
    }));
  }

  @Query(() => [EngagementPlanOutput])
  @UseGuards(WorkspaceAuthGuard)
  async engagementPlans(): Promise<EngagementPlanOutput[]> {
    const prices = await this.billingPriceRepository.find({
      where: { active: true },
      order: { unitAmount: 'ASC' },
    });
    const GBP_10999_SUBUNITS = 1099900; // 10999 GBP in pence

    return prices
      .filter(
        (p): p is BillingPrice & { razorpayPlanId: string } =>
          p.razorpayPlanId != null && p.razorpayPlanId !== '',
      )
      .filter(
        (p) =>
          !(
            p.currency === 'GBP' && Number(p.unitAmount) === GBP_10999_SUBUNITS
          ),
      )
      .map((p) => {
        const isYearly = p.interval === SubscriptionInterval.Year;

        return {
          id: p.razorpayPlanId,
          name: p.nickname ?? p.razorpayPlanId,
          amount: Number(p.unitAmount) ?? 0,
          currency: p.currency,
          period: isYearly ? 'yearly' : 'monthly',
          interval: isYearly ? 12 : 1,
        };
      });
  }

  @Query(() => CreditTransactionsOutput)
  @UseGuards(WorkspaceAuthGuard)
  async creditTransactions(
    @AuthWorkspace() workspace: Workspace,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('cursor', { nullable: true }) cursor?: string,
  ): Promise<CreditTransactionsOutput> {
    const { items, nextCursor } =
      await this.creditTransactionService.findByWorkspace(workspace.id, {
        limit,
        cursor,
      });

    return {
      items: items.map((t) => ({
        id: t.id,
        type: t.type,
        creditType: t.creditType,
        amount: t.amount,
        metadata: t.metadata,
        createdAt: t.createdAt,
      })),
      nextCursor,
    };
  }

  @Query(() => WorkspaceCreditsOutput)
  @UseGuards(WorkspaceAuthGuard)
  async workspaceCredits(
    @AuthWorkspace() workspace: Workspace,
  ): Promise<WorkspaceCreditsOutput> {
    const row = await this.workspaceCreditsRepository.findOne({
      where: { workspaceId: workspace.id },
    });

    const orgChartCredits = row?.orgChartCredits ?? 0;
    const revealCredits = row?.revealCredits ?? 0;
    const emailRevealCost = getRevealCost('email');
    const phoneRevealCost = getRevealCost('phone');

    return {
      orgChartCredits,
      revealCredits,
      revealCreditsAsEmailEquivalent:
        emailRevealCost > 0 ? Math.floor(revealCredits / emailRevealCost) : 0,
      revealCreditsAsPhoneEquivalent:
        phoneRevealCost > 0 ? Math.floor(revealCredits / phoneRevealCost) : 0,
      emailRevealCost,
      phoneRevealCost,
    };
  }

  @Mutation(() => RazorpayOrderOutput)
  @UseGuards(WorkspaceAuthGuard)
  async createRazorpayOrderForCredits(
    @AuthWorkspace() workspace: Workspace,
    @Args('input', { type: () => CreateRazorpayOrderInput })
    input: CreateRazorpayOrderInput,
  ): Promise<RazorpayOrderOutput> {
    const result = await this.razorpayOrderService.createOrderForCredits(
      workspace.id,
      input.creditPackKey,
      input.currency,
    );

    return {
      orderId: result.orderId,
      amount: result.amount,
      currency: result.currency,
      keyId: result.keyId,
    };
  }

  @Mutation(() => RequestInvoiceForCreditsOutput)
  @UseGuards(WorkspaceAuthGuard, UserAuthGuard)
  async requestInvoiceForCredits(
    @AuthWorkspace() workspace: Workspace,
    @AuthUser() user: User,
    @Args('input', { type: () => RequestInvoiceForCreditsInput })
    input: RequestInvoiceForCreditsInput,
  ): Promise<RequestInvoiceForCreditsOutput> {
    await this.invoiceRequestService.requestInvoice({
      workspaceId: workspace.id,
      userEmail: user.email,
      creditPackKey: input.creditPackKey,
      companyName: input.companyName,
      billingAddress: input.billingAddress,
      billingEmail: input.billingEmail,
      vatNumber: input.vatNumber,
      currency: input.currency,
    });

    return { success: true };
  }

  @Query(() => [AdminWorkspaceCreditsRowOutput])
  @UseGuards(WorkspaceAuthGuard, UserAuthGuard, ImpersonateGuard)
  async adminListWorkspacesWithCredits(): Promise<
    AdminWorkspaceCreditsRowOutput[]
  > {
    const workspaces = await this.workspaceRepository.find({
      select: ['id', 'displayName', 'createdAt'],
      order: { createdAt: 'DESC' },
    });
    const creatorRows =
      await this.userWorkspaceRepository
        .createQueryBuilder('uw')
        .innerJoin('uw.user', 'user')
        .select('uw.workspaceId', 'workspaceId')
        .addSelect('user.email', 'email')
        .where('uw.deletedAt IS NULL')
        .andWhere('user.deletedAt IS NULL')
        .distinctOn(['uw.workspaceId'])
        .orderBy('uw.workspaceId', 'ASC')
        .addOrderBy('uw.createdAt', 'ASC')
        .getRawMany<AdminWorkspaceCreatorEmailRow>();
    const creatorEmailByWorkspaceId = new Map<string, string>(
      creatorRows.map((row) => [row.workspaceId, row.email]),
    );
    const creditsRows = await this.workspaceCreditsRepository.find();
    const creditsByWorkspaceId = new Map<string, WorkspaceCredits>(
      creditsRows.map((row) => [row.workspaceId, row]),
    );

    return workspaces.map(
      (workspace): AdminWorkspaceCreditsRowOutput => {
        const credits = creditsByWorkspaceId.get(workspace.id);

        return {
          workspaceId: workspace.id,
          workspaceCreatedAt: workspace.createdAt,
          workspaceName: workspace.displayName ?? '',
          workspaceCreatorEmail:
            creatorEmailByWorkspaceId.get(workspace.id) ?? null,
          orgChartCredits: credits?.orgChartCredits ?? 0,
          revealCredits: credits?.revealCredits ?? 0,
        };
      },
    );
  } 

  @Mutation(() => Boolean)
  @UseGuards(WorkspaceAuthGuard, UserAuthGuard, ImpersonateGuard)
  async adminAdjustWorkspaceCredits(
    @Args('input', { type: () => AdminAdjustWorkspaceCreditsInput })
    input: AdminAdjustWorkspaceCreditsInput,
  ): Promise<boolean> {
    await this.workspaceCreditsService.adjustCredits(
      input.workspaceId,
      input.creditType as 'org_chart' | 'reveal',
      input.delta,
    );

    return true;
  }
}
