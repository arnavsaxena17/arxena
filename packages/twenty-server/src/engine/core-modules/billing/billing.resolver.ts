/* @license Enterprise */

import { UseFilters, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { GraphQLError } from 'graphql';
import { SettingsFeatures } from 'twenty-shared';

import { BillingCheckoutSessionInput } from 'src/engine/core-modules/billing/dtos/inputs/billing-checkout-session.input';
import { BillingProductInput } from 'src/engine/core-modules/billing/dtos/inputs/billing-product.input';
import { BillingSessionInput } from 'src/engine/core-modules/billing/dtos/inputs/billing-session.input';
import { CreateRazorpayOrderForCreditsInput } from 'src/engine/core-modules/billing/dtos/inputs/create-razorpay-order.input';
import { BillingPlanOutput } from 'src/engine/core-modules/billing/dtos/outputs/billing-plan.output';
import { BillingProductPricesOutput } from 'src/engine/core-modules/billing/dtos/outputs/billing-product-prices.output';
import { BillingProviderEnum, BillingProviderOutput } from 'src/engine/core-modules/billing/dtos/outputs/billing-provider.output';
import { BillingSessionOutput } from 'src/engine/core-modules/billing/dtos/outputs/billing-session.output';
import { BillingUpdateOutput } from 'src/engine/core-modules/billing/dtos/outputs/billing-update.output';
import { CreditPackOutput } from 'src/engine/core-modules/billing/dtos/outputs/credit-pack.output';
import { EngagementPlanOutput } from 'src/engine/core-modules/billing/dtos/outputs/engagement-plan.output';
import { RazorpayOrderForCreditsOutput } from 'src/engine/core-modules/billing/dtos/outputs/razorpay-order.output';
import { WorkspaceCreditsOutput } from 'src/engine/core-modules/billing/dtos/outputs/workspace-credits.output';
import { WorkspaceCredits } from 'src/engine/core-modules/billing/entities/workspace-credits.entity';
import { AvailableProduct } from 'src/engine/core-modules/billing/enums/billing-available-product.enum';
import { BillingPlanKey } from 'src/engine/core-modules/billing/enums/billing-plan-key.enum';
import { RAZORPAY_CREDIT_PACKS } from 'src/engine/core-modules/billing/razorpay/constants/credit-packs.constant';
import { RazorpayOrderService } from 'src/engine/core-modules/billing/razorpay/services/razorpay-order.service';
import { RazorpayPlanService } from 'src/engine/core-modules/billing/razorpay/services/razorpay-plan.service';
import { RazorpaySubscriptionService } from 'src/engine/core-modules/billing/razorpay/services/razorpay-subscription.service';
import { BillingPlanService } from 'src/engine/core-modules/billing/services/billing-plan.service';
import { BillingPortalWorkspaceService } from 'src/engine/core-modules/billing/services/billing-portal.workspace-service';
import { BillingSubscriptionService } from 'src/engine/core-modules/billing/services/billing-subscription.service';
import { StripePriceService } from 'src/engine/core-modules/billing/stripe/services/stripe-price.service';
import { BillingPortalCheckoutSessionParameters } from 'src/engine/core-modules/billing/types/billing-portal-checkout-session-parameters.type';
import { formatBillingDatabaseProductToGraphqlDTO } from 'src/engine/core-modules/billing/utils/format-database-product-to-graphql-dto.util';
import { FeatureFlagKey } from 'src/engine/core-modules/feature-flag/enums/feature-flag-key.enum';
import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { User } from 'src/engine/core-modules/user/user.entity';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthUser } from 'src/engine/decorators/auth/auth-user.decorator';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { SettingsPermissionsGuard } from 'src/engine/guards/settings-permissions.guard';
import { UserAuthGuard } from 'src/engine/guards/user-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { PermissionsGraphqlApiExceptionFilter } from 'src/engine/metadata-modules/permissions/utils/permissions-graphql-api-exception.filter';

@Resolver()
@UseFilters(PermissionsGraphqlApiExceptionFilter)
export class BillingResolver {
  constructor(
    private readonly billingSubscriptionService: BillingSubscriptionService,
    private readonly billingPortalWorkspaceService: BillingPortalWorkspaceService,
    private readonly stripePriceService: StripePriceService,
    private readonly billingPlanService: BillingPlanService,
    private readonly featureFlagService: FeatureFlagService,
    private readonly razorpayOrderService: RazorpayOrderService,
    private readonly razorpayPlanService: RazorpayPlanService,
    private readonly razorpaySubscriptionService: RazorpaySubscriptionService,
    @InjectRepository(WorkspaceCredits, 'core')
    private readonly workspaceCreditsRepository: Repository<WorkspaceCredits>,
  ) {}

  @UseGuards(WorkspaceAuthGuard)
  @Query(() => BillingProviderOutput)
  async billingProvider(@AuthWorkspace() _workspace: Workspace): Promise<BillingProviderOutput> {
    const provider = this.billingPortalWorkspaceService.getBillingProvider();
    return {
      provider: provider === 'razorpay' ? BillingProviderEnum.razorpay : BillingProviderEnum.stripe,
    };
  }

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
      plan,
      requirePaymentMethod,
      engagementInterval,
    }: BillingCheckoutSessionInput,
  ) {
    const provider = this.billingPortalWorkspaceService.getBillingProvider();
    if (provider === 'razorpay') {
      if (!engagementInterval) {
        throw new GraphQLError(
          'engagementInterval (quarterly | 6month | annual) is required when billing provider is Razorpay',
        );
      }
      const planId = this.razorpayPlanService.getPlanIdForInterval(
        engagementInterval as 'quarterly' | '6month' | 'annual',
      );
      if (!planId) {
        const envVar =
          engagementInterval === 'quarterly'
            ? 'BILLING_RAZORPAY_PLAN_QUARTERLY_ID'
            : engagementInterval === '6month'
              ? 'BILLING_RAZORPAY_PLAN_6MONTH_ID'
              : 'BILLING_RAZORPAY_BASE_PLAN_ID';
        throw new GraphQLError(
          `Razorpay engagement plan not configured for interval: ${engagementInterval}. Set ${envVar} in .env (or run razorpay:setup-plans-and-links to create plans, then add the printed env vars to .env).`,
        );
      }
      const totalCount = engagementInterval === 'annual' ? 1 : engagementInterval === '6month' ? 2 : 4;
      const { shortUrl } = await this.razorpaySubscriptionService.createSubscriptionLink({
        planId,
        workspaceId: workspace.id,
        totalCount,
      });
      return { url: shortUrl };
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
    };
  }

  @Mutation(() => BillingUpdateOutput)
  @UseGuards(WorkspaceAuthGuard, UserAuthGuard)
  async startTrial(
    @AuthWorkspace() workspace: Workspace,
    @AuthUser() user: User,
  ) {
    const { started } =
      await this.billingPortalWorkspaceService.startTrialForWorkspace({
        user,
        workspace,
      });
    return { success: started };
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

  @Query(() => [CreditPackOutput])
  @UseGuards(WorkspaceAuthGuard)
  async creditPacks(): Promise<CreditPackOutput[]> {
    return RAZORPAY_CREDIT_PACKS.map((pack) => ({
      key: pack.key,
      name: pack.name,
      credits: pack.credits,
      amountSubunits: pack.amountSubunits,
      currency: pack.currency,
    }));
  }

  @Query(() => [EngagementPlanOutput])
  @UseGuards(WorkspaceAuthGuard)
  async engagementPlans(): Promise<EngagementPlanOutput[]> {
    return this.razorpayPlanService.getEngagementPlans();
  }

  @Query(() => WorkspaceCreditsOutput)
  @UseGuards(WorkspaceAuthGuard)
  async workspaceCredits(@AuthWorkspace() workspace: Workspace): Promise<WorkspaceCreditsOutput> {
    const row = await this.workspaceCreditsRepository.findOne({
      where: { workspaceId: workspace.id },
    });
    return { credits: row?.credits ?? 0 };
  }

  @Mutation(() => RazorpayOrderForCreditsOutput)
  @UseGuards(WorkspaceAuthGuard, UserAuthGuard)
  async createRazorpayOrderForCredits(
    @AuthWorkspace() workspace: Workspace,
    @Args() { creditPackKey, currency }: CreateRazorpayOrderForCreditsInput,
  ): Promise<RazorpayOrderForCreditsOutput> {
    const result = await this.razorpayOrderService.createOrderForCredits(
      workspace.id,
      creditPackKey as 'credits_5' | 'credits_10',
      currency,
    );
    return {
      orderId: result.orderId,
      amount: result.amount,
      currency: result.currency,
      keyId: result.keyId,
      creditPackKey: result.creditPackKey,
      credits: result.credits,
    };
  }
}
