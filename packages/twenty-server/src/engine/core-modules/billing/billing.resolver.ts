/* @license Enterprise */

import { UseFilters, UseGuards, UsePipes } from '@nestjs/common';
import { Args, Context, Int, Mutation, Query } from '@nestjs/graphql';
import { InjectRepository } from '@nestjs/typeorm';

import { type Request } from 'express';
import { PermissionFlagType } from 'twenty-shared/constants';
import { getRevealCost } from 'twenty-shared';
import { WorkspaceActivationStatus } from 'twenty-shared/workspace';
import { type Repository } from 'typeorm';

import { MetadataResolver } from 'src/engine/api/graphql/graphql-config/decorators/metadata-resolver.decorator';
import { type ApiKeyEntity } from 'src/engine/core-modules/api-key/api-key.entity';
import { type AuthContextUser } from 'src/engine/core-modules/auth/types/auth-context.type';
import { BillingEndTrialPeriodDTO } from 'src/engine/core-modules/billing/dtos/billing-end-trial-period.dto';
import { BillingResourceCreditUsageDTO } from 'src/engine/core-modules/billing/dtos/billing-resource-credit-usage.dto';
import { BillingPlanDTO } from 'src/engine/core-modules/billing/dtos/billing-plan.dto';
import { BillingPaymentIntentDTO } from 'src/engine/core-modules/billing/dtos/billing-payment-intent.dto';
import { BillingSessionDTO } from 'src/engine/core-modules/billing/dtos/billing-session.dto';
import { BillingUpdateDTO } from 'src/engine/core-modules/billing/dtos/billing-update.dto';
import { BillingCheckoutSessionInput } from 'src/engine/core-modules/billing/dtos/inputs/billing-checkout-session.input';
import { BillingSessionInput } from 'src/engine/core-modules/billing/dtos/inputs/billing-session.input';
import { BillingUpdateSubscriptionItemPriceInput } from 'src/engine/core-modules/billing/dtos/inputs/billing-update-subscription-item-price.input';
import { CreateRazorpayOrderInput } from 'src/engine/core-modules/billing/dtos/inputs/create-razorpay-order.input';
import { RequestInvoiceForCreditsInput } from 'src/engine/core-modules/billing/dtos/inputs/request-invoice-for-credits.input';
import {
  BillingProviderEnum,
  BillingProviderOutput,
} from 'src/engine/core-modules/billing/dtos/outputs/billing-provider.output';
import { CreditPackOutput } from 'src/engine/core-modules/billing/dtos/outputs/credit-pack.output';
import { CreditTransactionsOutput } from 'src/engine/core-modules/billing/dtos/outputs/credit-transaction.output';
import { EngagementPlanOutput } from 'src/engine/core-modules/billing/dtos/outputs/engagement-plan.output';
import { RazorpayOrderOutput } from 'src/engine/core-modules/billing/dtos/outputs/razorpay-order.output';
import { RequestInvoiceForCreditsOutput } from 'src/engine/core-modules/billing/dtos/outputs/request-invoice-for-credits.output';
import { WorkspaceCreditsOutput } from 'src/engine/core-modules/billing/dtos/outputs/workspace-credits.output';
import { BillingPriceEntity } from 'src/engine/core-modules/billing/entities/billing-price.entity';
import { WorkspaceCredits } from 'src/engine/core-modules/billing/entities/workspace-credits.entity';
import { BillingPlanKey } from 'src/engine/core-modules/billing/enums/billing-plan-key.enum';
import { SubscriptionInterval } from 'src/engine/core-modules/billing/enums/billing-subscription-interval.enum';
import { RAZORPAY_CREDIT_PACKS } from 'src/engine/core-modules/billing/razorpay/constants/credit-packs.constant';
import { RazorpayOrderService } from 'src/engine/core-modules/billing/razorpay/services/razorpay-order.service';
import { BillingPlanService } from 'src/engine/core-modules/billing/services/billing-plan.service';
import { BillingPortalWorkspaceService } from 'src/engine/core-modules/billing/services/billing-portal.workspace-service';
import { BillingSubscriptionUpdateService } from 'src/engine/core-modules/billing/services/billing-subscription-update.service';
import { BillingSubscriptionService } from 'src/engine/core-modules/billing/services/billing-subscription.service';
import { BillingUsageService } from 'src/engine/core-modules/billing/services/billing-usage.service';
import { BillingService } from 'src/engine/core-modules/billing/services/billing.service';
import { CreditTransactionService } from 'src/engine/core-modules/billing/services/credit-transaction.service';
import { InvoiceRequestService } from 'src/engine/core-modules/billing/services/invoice-request.service';
import { PricingCurrencyService } from 'src/engine/core-modules/billing/services/pricing-currency.service';
import { formatBillingDatabaseProductToGraphqlDTO } from 'src/engine/core-modules/billing/utils/format-database-product-to-graphql-dto.util';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { PreventNestToAutoLogGraphqlErrorsFilter } from 'src/engine/core-modules/graphql/filters/prevent-nest-to-auto-log-graphql-errors.filter';
import { ResolverValidationPipe } from 'src/engine/core-modules/graphql/pipes/resolver-validation.pipe';
import {
  INTERNAL_CREDITS_PER_DISPLAY_CREDIT,
  toDisplayCredits,
} from 'src/engine/core-modules/usage/utils/to-display-credits.util';
import { type WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthApiKey } from 'src/engine/decorators/auth/auth-api-key.decorator';
import { AuthUserWorkspaceId } from 'src/engine/decorators/auth/auth-user-workspace-id.decorator';
import { AuthUser } from 'src/engine/decorators/auth/auth-user.decorator';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { SettingsPermissionGuard } from 'src/engine/guards/settings-permission.guard';
import { UserAuthGuard } from 'src/engine/guards/user-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import {
  PermissionsException,
  PermissionsExceptionCode,
  PermissionsExceptionMessage,
} from 'src/engine/metadata-modules/permissions/permissions.exception';
import { PermissionsService } from 'src/engine/metadata-modules/permissions/permissions.service';
import { PermissionsGraphqlApiExceptionFilter } from 'src/engine/metadata-modules/permissions/utils/permissions-graphql-api-exception.filter';
@MetadataResolver()
@UsePipes(ResolverValidationPipe)
@UseFilters(
  PermissionsGraphqlApiExceptionFilter,
  PreventNestToAutoLogGraphqlErrorsFilter,
)
export class BillingResolver {
  constructor(
    private readonly billingSubscriptionService: BillingSubscriptionService,
    private readonly billingSubscriptionUpdateService: BillingSubscriptionUpdateService,
    private readonly billingPortalWorkspaceService: BillingPortalWorkspaceService,
    private readonly billingPlanService: BillingPlanService,
    private readonly billingService: BillingService,
    private readonly billingUsageService: BillingUsageService,
    private readonly permissionsService: PermissionsService,
    private readonly environmentService: EnvironmentService,
    private readonly razorpayOrderService: RazorpayOrderService,
    private readonly invoiceRequestService: InvoiceRequestService,
    private readonly pricingCurrencyService: PricingCurrencyService,
    private readonly creditTransactionService: CreditTransactionService,
    @InjectRepository(WorkspaceCredits)
    private readonly workspaceCreditsRepository: Repository<WorkspaceCredits>,
    @InjectRepository(BillingPriceEntity)
    private readonly billingPriceRepository: Repository<BillingPriceEntity>,
  ) {}

  @Query(() => BillingSessionDTO)
  @UseGuards(
    WorkspaceAuthGuard,
    SettingsPermissionGuard(PermissionFlagType.BILLING),
  )
  async billingPortalSession(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Args() { returnUrlPath, forPaymentMethodUpdate }: BillingSessionInput,
  ) {
    return {
      url: await this.billingPortalWorkspaceService.computeBillingPortalSessionURLOrThrow(
        workspace,
        returnUrlPath,
        forPaymentMethodUpdate,
      ),
    };
  }

  @Mutation(() => BillingSessionDTO)
  @UseGuards(WorkspaceAuthGuard, UserAuthGuard, NoPermissionGuard)
  async checkoutSession(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthUser() user: AuthContextUser,
    @AuthUserWorkspaceId() userWorkspaceId: string,
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
    @AuthApiKey() apiKey?: ApiKeyEntity,
  ) {
    await this.validateCanCheckoutSessionPermissionOrThrow({
      workspaceId: workspace.id,
      userWorkspaceId,
      apiKeyId: apiKey?.id,
      workspaceActivationStatus: workspace.activationStatus,
    });

    if (this.environmentService.get('BILLING_PROVIDER') === 'razorpay') {
      // Mirror Stripe: no-card trial creates a local trialing subscription and
      // returns a success URL. Paid checkout still opens Razorpay Checkout.
      if (!requirePaymentMethod) {
        const successUrl =
          await this.billingPortalWorkspaceService.createDirectRazorpayTrialSubscription(
            {
              workspace,
              successUrlPath,
              plan: plan ?? BillingPlanKey.PRO,
              interval: recurringInterval,
            },
          );

        return {
          url: successUrl,
        };
      }

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

    const checkoutSessionParams = {
      user,
      workspace,
      successUrlPath,
      plan: plan ?? BillingPlanKey.PRO,
      requirePaymentMethod,
    };

    const billingPricesPerPlan =
      await this.billingPlanService.getPricesPerPlanByInterval({
        planKey: checkoutSessionParams.plan,
        interval: recurringInterval,
      });

    // For 7-day trials (no payment method required), create subscription directly
    // For 30-day trials (payment method required), use checkout session flow
    if (!requirePaymentMethod) {
      const successUrl =
        await this.billingPortalWorkspaceService.createDirectSubscription({
          ...checkoutSessionParams,
          billingPricesPerPlan,
        });

      return {
        url: successUrl,
      };
    } else {
      const checkoutSessionURL =
        await this.billingPortalWorkspaceService.computeCheckoutSessionURL({
          ...checkoutSessionParams,
          billingPricesPerPlan,
        });

      return {
        url: checkoutSessionURL,
      };
    }
  }

  @Mutation(() => BillingPaymentIntentDTO)
  @UseGuards(WorkspaceAuthGuard, UserAuthGuard, NoPermissionGuard)
  async createSubscriptionPaymentIntent(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthUser() user: AuthContextUser,
    @AuthUserWorkspaceId() userWorkspaceId: string,
    @Args() { recurringInterval, plan }: BillingCheckoutSessionInput,
    @Args('idempotencyKey', { type: () => String }) idempotencyKey: string,
    @AuthApiKey() apiKey?: ApiKeyEntity,
  ): Promise<BillingPaymentIntentDTO> {
    await this.validateCanCheckoutSessionPermissionOrThrow({
      workspaceId: workspace.id,
      userWorkspaceId,
      apiKeyId: apiKey?.id,
      workspaceActivationStatus: workspace.activationStatus,
    });

    const resolvedPlan = plan ?? BillingPlanKey.PRO;

    const billingPricesPerPlan =
      await this.billingPlanService.getPricesPerPlanByInterval({
        planKey: resolvedPlan,
        interval: recurringInterval,
      });

    return this.billingPortalWorkspaceService.createSubscriptionPaymentIntent({
      user,
      workspace,
      plan: resolvedPlan,
      billingPricesPerPlan,
      idempotencyKey,
    });
  }

  @Mutation(() => BillingPaymentIntentDTO)
  @UseGuards(
    WorkspaceAuthGuard,
    SettingsPermissionGuard(PermissionFlagType.BILLING),
  )
  async createBillingPaymentMethodSetupIntent(
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<BillingPaymentIntentDTO> {
    return this.billingPortalWorkspaceService.createPaymentMethodSetupIntent(
      workspace,
    );
  }

  @Mutation(() => BillingUpdateDTO)
  @UseGuards(
    WorkspaceAuthGuard,
    SettingsPermissionGuard(PermissionFlagType.BILLING),
  )
  async switchSubscriptionInterval(
    @AuthWorkspace() workspace: WorkspaceEntity,
  ) {
    await this.billingSubscriptionUpdateService.changeInterval(workspace.id);

    return {
      billingSubscriptions:
        await this.billingSubscriptionService.getBillingSubscriptions(
          workspace.id,
        ),
      currentBillingSubscription:
        await this.billingSubscriptionService.getCurrentBillingSubscriptionOrThrow(
          { workspaceId: workspace.id },
        ),
    };
  }

  @Mutation(() => BillingUpdateDTO)
  @UseGuards(
    WorkspaceAuthGuard,
    SettingsPermissionGuard(PermissionFlagType.BILLING),
  )
  async switchBillingPlan(@AuthWorkspace() workspace: WorkspaceEntity) {
    await this.billingSubscriptionUpdateService.changePlan(workspace.id);

    return {
      billingSubscriptions:
        await this.billingSubscriptionService.getBillingSubscriptions(
          workspace.id,
        ),
      currentBillingSubscription:
        await this.billingSubscriptionService.getCurrentBillingSubscriptionOrThrow(
          { workspaceId: workspace.id },
        ),
    };
  }

  @Mutation(() => BillingUpdateDTO)
  @UseGuards(
    WorkspaceAuthGuard,
    SettingsPermissionGuard(PermissionFlagType.BILLING),
  )
  async cancelSwitchBillingPlan(@AuthWorkspace() workspace: WorkspaceEntity) {
    await this.billingSubscriptionUpdateService.cancelSwitchPlan(workspace.id);

    return {
      billingSubscriptions:
        await this.billingSubscriptionService.getBillingSubscriptions(
          workspace.id,
        ),
      currentBillingSubscription:
        await this.billingSubscriptionService.getCurrentBillingSubscriptionOrThrow(
          { workspaceId: workspace.id },
        ),
    };
  }

  @Mutation(() => BillingUpdateDTO)
  @UseGuards(
    WorkspaceAuthGuard,
    SettingsPermissionGuard(PermissionFlagType.BILLING),
  )
  async cancelSwitchBillingInterval(
    @AuthWorkspace() workspace: WorkspaceEntity,
  ) {
    await this.billingSubscriptionUpdateService.cancelSwitchInterval(
      workspace.id,
    );

    return {
      billingSubscriptions:
        await this.billingSubscriptionService.getBillingSubscriptions(
          workspace.id,
        ),
      currentBillingSubscription:
        await this.billingSubscriptionService.getCurrentBillingSubscriptionOrThrow(
          { workspaceId: workspace.id },
        ),
    };
  }

  @Mutation(() => BillingUpdateDTO)
  @UseGuards(
    WorkspaceAuthGuard,
    SettingsPermissionGuard(PermissionFlagType.BILLING),
  )
  async setResourceCreditSubscriptionPrice(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Args() { priceId }: BillingUpdateSubscriptionItemPriceInput,
  ) {
    await this.billingSubscriptionUpdateService.changeResourceCreditPrice(
      workspace.id,
      priceId,
    );

    return {
      billingSubscriptions:
        await this.billingSubscriptionService.getBillingSubscriptions(
          workspace.id,
        ),
      currentBillingSubscription:
        await this.billingSubscriptionService.getCurrentBillingSubscriptionOrThrow(
          { workspaceId: workspace.id },
        ),
    };
  }

  @Query(() => [BillingPlanDTO])
  @UseGuards(WorkspaceAuthGuard, NoPermissionGuard)
  async listPlans(): Promise<BillingPlanDTO[]> {
    const plans = await this.billingPlanService.listPlans();

    return plans.map(formatBillingDatabaseProductToGraphqlDTO);
  }

  @Mutation(() => BillingEndTrialPeriodDTO)
  @UseGuards(
    WorkspaceAuthGuard,
    SettingsPermissionGuard(PermissionFlagType.BILLING),
  )
  async endSubscriptionTrialPeriod(
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<BillingEndTrialPeriodDTO> {
    const result =
      await this.billingSubscriptionService.endTrialPeriod(workspace);

    if (!result.hasPaymentMethod && result.stripeCustomerId) {
      const billingPortalUrl =
        await this.billingPortalWorkspaceService.computeBillingPortalSessionURLForPaymentMethodUpdate(
          workspace,
          result.stripeCustomerId,
          '/settings/billing',
        );

      return {
        hasPaymentMethod: false,
        status: undefined,
        billingPortalUrl,
      };
    }

    return {
      hasPaymentMethod: result.hasPaymentMethod,
      status: result.status,
    };
  }

  @Query(() => [BillingResourceCreditUsageDTO])
  @UseGuards(
    WorkspaceAuthGuard,
    SettingsPermissionGuard(PermissionFlagType.BILLING),
  )
  async getResourceCreditUsage(
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<BillingResourceCreditUsageDTO[]> {
    const usageData =
      await this.billingUsageService.getResourceCreditProductUsage(workspace);

    return usageData.map((item) => ({
      ...item,
      usedCredits: toDisplayCredits(item.usedCredits),
      grantedCredits: toDisplayCredits(item.grantedCredits),
      rolloverCredits: toDisplayCredits(item.rolloverCredits),
      totalGrantedCredits: toDisplayCredits(item.totalGrantedCredits),
      unitPriceCents: item.unitPriceCents * INTERNAL_CREDITS_PER_DISPLAY_CREDIT,
    }));
  }

  @Mutation(() => BillingUpdateDTO)
  @UseGuards(
    WorkspaceAuthGuard,
    SettingsPermissionGuard(PermissionFlagType.BILLING),
  )
  async cancelSwitchResourceCreditPrice(
    @AuthWorkspace() workspace: WorkspaceEntity,
  ) {
    await this.billingSubscriptionUpdateService.cancelSwitchResourceCreditPrice(
      workspace,
    );

    return {
      billingSubscriptions:
        await this.billingSubscriptionService.getBillingSubscriptions(
          workspace.id,
        ),
      currentBillingSubscription:
        await this.billingSubscriptionService.getCurrentBillingSubscriptionOrThrow(
          { workspaceId: workspace.id },
        ),
    };
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
    return this.pricingCurrencyService.getRequestPricingCurrency(context.req);
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

    return prices
      .filter(
        (price): price is BillingPriceEntity & { razorpayPlanId: string } =>
          price.razorpayPlanId != null && price.razorpayPlanId !== '',
      )
      .map((price) => {
        const intervalCount = price.recurring?.interval_count ?? 1;
        const isYearly = price.interval === SubscriptionInterval.Year;
        let period = 'monthly';

        if (isYearly) {
          period = 'yearly';
        } else if (intervalCount === 3) {
          period = 'quarterly';
        } else if (intervalCount === 6) {
          period = '6-month';
        }

        return {
          id: price.razorpayPlanId,
          name: price.nickname ?? price.razorpayPlanId,
          amount: Number(price.unitAmount) ?? 0,
          currency: price.currency,
          period,
          interval: isYearly ? 12 : intervalCount,
        };
      });
  }

  @Query(() => CreditTransactionsOutput)
  @UseGuards(WorkspaceAuthGuard)
  async creditTransactions(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @Args('cursor', { nullable: true }) cursor?: string,
  ): Promise<CreditTransactionsOutput> {
    const { items, nextCursor } =
      await this.creditTransactionService.findByWorkspace(workspace.id, {
        limit,
        cursor,
      });

    return {
      items: items.map((transaction) => ({
        id: transaction.id,
        type: transaction.type,
        creditType: transaction.creditType,
        amount: transaction.amount,
        metadata: transaction.metadata,
        createdAt: transaction.createdAt,
      })),
      nextCursor,
    };
  }

  @Query(() => WorkspaceCreditsOutput)
  @UseGuards(WorkspaceAuthGuard)
  async workspaceCredits(
    @AuthWorkspace() workspace: WorkspaceEntity,
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
    @AuthWorkspace() workspace: WorkspaceEntity,
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
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthUser() user: AuthContextUser,
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

  private async validateCanCheckoutSessionPermissionOrThrow({
    workspaceId,
    userWorkspaceId,
    apiKeyId,
    workspaceActivationStatus,
  }: {
    workspaceId: string;
    userWorkspaceId: string;
    apiKeyId?: string;
    workspaceActivationStatus: WorkspaceActivationStatus;
  }) {
    if (
      (await this.billingService.isSubscriptionIncompleteOnboardingStatus(
        workspaceId,
      )) ||
      workspaceActivationStatus ===
        WorkspaceActivationStatus.PENDING_CREATION ||
      workspaceActivationStatus === WorkspaceActivationStatus.ONGOING_CREATION
    ) {
      return;
    }

    const userHasPermission =
      await this.permissionsService.userHasWorkspaceSettingPermission({
        userWorkspaceId,
        workspaceId,
        setting: PermissionFlagType.BILLING,
        apiKeyId,
      });

    if (!userHasPermission) {
      throw new PermissionsException(
        PermissionsExceptionMessage.PERMISSION_DENIED,
        PermissionsExceptionCode.PERMISSION_DENIED,
      );
    }
  }
}
