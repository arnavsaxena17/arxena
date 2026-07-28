/* @license Enterprise */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import {
  assertIsDefinedOrThrow,
  findOrThrow,
  isDefined,
  isNonEmptyArray,
} from 'twenty-shared/utils';
import { IsNull, Not, Repository } from 'typeorm';

import type Stripe from 'stripe';

import {
  BillingException,
  BillingExceptionCode,
} from 'src/engine/core-modules/billing/billing.exception';
import { BillingCustomerEntity } from 'src/engine/core-modules/billing/entities/billing-customer.entity';
import { BillingPriceEntity } from 'src/engine/core-modules/billing/entities/billing-price.entity';
import { BillingSubscriptionEntity } from 'src/engine/core-modules/billing/entities/billing-subscription.entity';
import { RAZORPAY_BASE_PRODUCT_ID } from 'src/engine/core-modules/billing/constants/razorpay-base-product.constant';
import { BillingPlanKey } from 'src/engine/core-modules/billing/enums/billing-plan-key.enum';
import { BillingProductKey } from 'src/engine/core-modules/billing/enums/billing-product-key.enum';
import { SubscriptionInterval } from 'src/engine/core-modules/billing/enums/billing-subscription-interval.enum';
import { SubscriptionStatus } from 'src/engine/core-modules/billing/enums/billing-subscription-status.enum';
import { BillingSubscriptionService } from 'src/engine/core-modules/billing/services/billing-subscription.service';
import { WorkspaceCreditsService } from 'src/engine/core-modules/billing/services/workspace-credits.service';
import { StripeBillingPortalService } from 'src/engine/core-modules/billing/stripe/services/stripe-billing-portal.service';
import { StripeCheckoutService } from 'src/engine/core-modules/billing/stripe/services/stripe-checkout.service';
import { StripeCustomerService } from 'src/engine/core-modules/billing/stripe/services/stripe-customer.service';
import { type BillingGetPricesPerPlanResult } from 'src/engine/core-modules/billing/types/billing-get-prices-per-plan-result.type';
import { type BillingPortalCheckoutSessionParameters } from 'src/engine/core-modules/billing/types/billing-portal-checkout-session-parameters.type';
import { WorkspaceDomainsService } from 'src/engine/core-modules/domain/workspace-domains/services/workspace-domains.service';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { RazorpayCheckoutService } from 'src/engine/core-modules/billing/razorpay/services/razorpay-checkout.service';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { type WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { InjectWorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/inject-workspace-scoped-repository.decorator';
import { WorkspaceScopedRepository } from 'src/engine/twenty-orm/workspace-scoped-repository/workspace-scoped-repository';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { assert } from 'src/utils/assert';
@Injectable()
export class BillingPortalWorkspaceService {
  protected readonly logger = new Logger(BillingPortalWorkspaceService.name);
  constructor(
    private readonly stripeCheckoutService: StripeCheckoutService,
    private readonly stripeCustomerService: StripeCustomerService,
    private readonly stripeBillingPortalService: StripeBillingPortalService,
    private readonly workspaceDomainsService: WorkspaceDomainsService,
    private readonly billingSubscriptionService: BillingSubscriptionService,
    private readonly environmentService: EnvironmentService,
    private readonly razorpayCheckoutService: RazorpayCheckoutService,
    private readonly workspaceCreditsService: WorkspaceCreditsService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    @InjectWorkspaceScopedRepository(BillingSubscriptionEntity)
    private readonly billingSubscriptionRepository: WorkspaceScopedRepository<BillingSubscriptionEntity>,
    @InjectWorkspaceScopedRepository(BillingCustomerEntity)
    private readonly billingCustomerRepository: WorkspaceScopedRepository<BillingCustomerEntity>,
    @InjectRepository(BillingPriceEntity)
    private readonly billingPriceRepository: Repository<BillingPriceEntity>,
    @InjectRepository(UserWorkspaceEntity)
    private readonly userWorkspaceRepository: Repository<UserWorkspaceEntity>,
  ) {}

  async computeRazorpayCheckoutSession(params: {
    workspace: WorkspaceEntity;
    successUrlPath: string;
    successReturnUrl?: string;
    razorpayPlanId?: string;
    quantity?: number;
  }): Promise<{
    subscriptionId: string;
    keyId: string;
    callbackUrl: string;
  }> {
    const planId = await this.resolveRazorpayPlanId(params.razorpayPlanId);

    assert(
      planId,
      'razorpayPlanId, BILLING_RAZORPAY_BASE_PLAN_ID, or an active synced Razorpay price is required',
    );

    const keyId = this.environmentService.get('BILLING_RAZORPAY_KEY_ID');

    assert(keyId, 'BILLING_RAZORPAY_KEY_ID is required');

    const serverUrl = this.environmentService.get('SERVER_URL');

    assert(serverUrl, 'SERVER_URL is required');

    const quantity = Math.max(1, params.quantity ?? 1);
    const { subscriptionId } =
      await this.razorpayCheckoutService.createSubscription({
        planId,
        workspaceId: params.workspace.id,
        quantity,
      });
    const base = `${serverUrl.replace(/\/$/, '')}/billing/razorpay-subscription-callback`;
    const search = new URLSearchParams();

    if (params.successReturnUrl) {
      search.set('return_url', params.successReturnUrl);
    } else {
      search.set('return_path', params.successUrlPath);
    }

    const callbackUrl = `${base}?${search.toString()}`;

    return { subscriptionId, keyId, callbackUrl };
  }

  // Local no-card trial for Razorpay provider (Stripe uses createDirectSubscription).
  // Skips Razorpay Checkout so plan-required "Basic without credit card" works.
  async createDirectRazorpayTrialSubscription({
    workspace,
    successUrlPath,
    plan = BillingPlanKey.PRO,
    interval = SubscriptionInterval.Month,
  }: {
    workspace: WorkspaceEntity;
    successUrlPath?: string;
    plan?: BillingPlanKey;
    interval?: SubscriptionInterval;
  }): Promise<string> {
    const frontBaseUrl = this.workspaceDomainsService.buildWorkspaceURL({
      workspace,
    });

    if (successUrlPath) {
      frontBaseUrl.pathname = successUrlPath;
    }

    const successUrl = frontBaseUrl.toString();
    const existingSubscriptions = await this.billingSubscriptionRepository.find(
      workspace.id,
      {
        where: { status: Not(SubscriptionStatus.Canceled) },
      },
    );

    if (isNonEmptyArray(existingSubscriptions)) {
      throw new BillingException(
        'Customer already has a non-canceled billing subscription',
        BillingExceptionCode.BILLING_SUBSCRIPTION_INVALID,
      );
    }

    const trialDurationDays = this.environmentService.get(
      'BILLING_FREE_TRIAL_WITHOUT_CREDIT_CARD_DURATION_IN_DAYS',
    );
    const trialStart = new Date();
    const trialEnd = new Date(
      trialStart.getTime() + trialDurationDays * 24 * 60 * 60 * 1000,
    );

    await this.billingCustomerRepository.upsert(
      workspace.id,
      {
        workspaceId: workspace.id,
        paymentProvider: 'razorpay',
        stripeCustomerId: null,
        hasPaymentMethod: false,
      },
      {
        conflictPaths: ['workspaceId'],
        skipUpdateIfNoValuesChanged: true,
      },
    );

    await this.billingSubscriptionRepository.insert(workspace.id, {
      workspaceId: workspace.id,
      status: SubscriptionStatus.Trialing,
      interval,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      razorpaySubscriptionId: null,
      currentPeriodStart: trialStart,
      currentPeriodEnd: trialEnd,
      trialStart,
      trialEnd,
      metadata: {
        workspaceId: workspace.id,
        plan,
        provider: 'razorpay',
        trialType: 'without_credit_card',
      },
    });

    await this.workspaceCreditsService.getOrCreate(workspace.id);
    await this.workspaceCacheService.invalidateAndRecompute(workspace.id, [
      'currentBillingSubscription',
    ]);

    this.logger.log(
      `Created Razorpay no-card trial for workspace ${workspace.id} (${trialDurationDays} days)`,
    );

    return successUrl;
  }

  // Prefer explicit arg, then env only if it matches a synced price, else latest
  // active razorpay_base price. Avoids stale BILLING_RAZORPAY_BASE_PLAN_ID.
  private async resolveRazorpayPlanId(
    explicitPlanId?: string,
  ): Promise<string | undefined> {
    if (isDefined(explicitPlanId) && explicitPlanId.length > 0) {
      return explicitPlanId;
    }

    const envPlanId = this.environmentService.get(
      'BILLING_RAZORPAY_BASE_PLAN_ID',
    );

    if (isDefined(envPlanId) && envPlanId.length > 0) {
      const matchingEnvPrice = await this.billingPriceRepository.findOne({
        where: {
          active: true,
          razorpayPlanId: envPlanId,
          stripeProductId: RAZORPAY_BASE_PRODUCT_ID,
        },
      });

      if (isDefined(matchingEnvPrice)) {
        return envPlanId;
      }

      this.logger.warn(
        `BILLING_RAZORPAY_BASE_PLAN_ID=${envPlanId} is not an active synced Razorpay price; falling back to catalog`,
      );
    }

    const syncedPrice = await this.billingPriceRepository.findOne({
      where: {
        active: true,
        stripeProductId: RAZORPAY_BASE_PRODUCT_ID,
        razorpayPlanId: Not(IsNull()),
      },
      order: { createdAt: 'DESC' },
    });

    return syncedPrice?.razorpayPlanId ?? envPlanId ?? undefined;
  }

  async computeCheckoutSessionURL({
    user,
    workspace,
    billingPricesPerPlan,
    successUrlPath,
    plan,
    requirePaymentMethod,
  }: BillingPortalCheckoutSessionParameters): Promise<string> {
    const { successUrl, cancelUrl, customer, stripeSubscriptionLineItems } =
      await this.prepareSubscriptionParameters({
        workspace,
        billingPricesPerPlan,
        successUrlPath,
      });

    const checkoutSession =
      await this.stripeCheckoutService.createCheckoutSession({
        user,
        workspace,
        stripeSubscriptionLineItems,
        successUrl,
        cancelUrl,
        stripeCustomerId: customer?.stripeCustomerId,
        plan,
        requirePaymentMethod,
        withTrialPeriod: this.isCustomerEligibleForTrialPeriod(customer),
      });

    assertIsDefinedOrThrow(
      checkoutSession.url,
      new BillingException(
        'Error: missing checkout.session.url',
        BillingExceptionCode.BILLING_STRIPE_ERROR,
      ),
    );

    return checkoutSession.url;
  }

  async createDirectSubscription({
    user,
    workspace,
    billingPricesPerPlan,
    successUrlPath,
    plan,
    requirePaymentMethod,
  }: BillingPortalCheckoutSessionParameters): Promise<string> {
    const { successUrl, customer, stripeSubscriptionLineItems } =
      await this.prepareSubscriptionParameters({
        workspace,
        billingPricesPerPlan,
        successUrlPath,
      });

    if (
      isNonEmptyArray(customer?.billingSubscriptions) &&
      customer.billingSubscriptions.some(
        (subscription) => subscription.status !== SubscriptionStatus.Canceled,
      )
    ) {
      throw new BillingException(
        'Customer already has a non-canceled billing subscription',
        BillingExceptionCode.BILLING_SUBSCRIPTION_INVALID,
      );
    }

    const stripeSubscription =
      await this.stripeCheckoutService.createDirectSubscription({
        user,
        workspace,
        stripeSubscriptionLineItems,
        stripeCustomerId: customer?.stripeCustomerId,
        plan,
        requirePaymentMethod,
        withTrialPeriod: this.isCustomerEligibleForTrialPeriod(customer),
      });

    await this.billingSubscriptionService.syncSubscriptionToDatabase(
      workspace.id,
      stripeSubscription.id,
    );

    return successUrl;
  }

  async createSubscriptionPaymentIntent({
    user,
    workspace,
    billingPricesPerPlan,
    plan,
    idempotencyKey,
  }: BillingPortalCheckoutSessionParameters & {
    idempotencyKey: string;
  }): Promise<{
    clientSecret: string;
    paymentIntentType: string;
  }> {
    const { customer, stripeSubscriptionLineItems } =
      await this.prepareSubscriptionParameters({
        workspace,
        billingPricesPerPlan,
      });

    const resumablePaymentIntent =
      await this.findResumableSubscriptionPaymentIntent(customer);

    if (isDefined(resumablePaymentIntent)) {
      return resumablePaymentIntent;
    }

    const stripeSubscription =
      await this.stripeCheckoutService.createSubscriptionWithPaymentMethodCollection(
        {
          user,
          workspace,
          stripeSubscriptionLineItems,
          stripeCustomerId: customer?.stripeCustomerId,
          plan,
          withTrialPeriod: this.isCustomerEligibleForTrialPeriod(customer),
          idempotencyKey,
        },
      );

    await this.billingSubscriptionService.syncSubscriptionToDatabase(
      workspace.id,
      stripeSubscription.id,
    );

    const paymentIntent =
      this.extractSubscriptionClientSecret(stripeSubscription);

    return paymentIntent;
  }

  async createPaymentMethodSetupIntent(
    workspace: WorkspaceEntity,
  ): Promise<{ clientSecret: string; paymentIntentType: string }> {
    const subscription = await this.billingSubscriptionRepository.findOne(
      workspace.id,
      {
        where: { status: Not(SubscriptionStatus.Canceled) },
        order: { createdAt: 'DESC' },
      },
    );

    const stripeCustomerId = subscription?.stripeCustomerId;

    if (!isDefined(stripeCustomerId)) {
      throw new BillingException(
        'Error: missing subscription for payment method setup intent',
        BillingExceptionCode.BILLING_SUBSCRIPTION_NOT_FOUND,
      );
    }

    const setupIntent =
      await this.stripeCustomerService.createSetupIntent(stripeCustomerId);

    assertIsDefinedOrThrow(
      setupIntent.client_secret,
      new BillingException(
        'Error: missing setupIntent.client_secret',
        BillingExceptionCode.BILLING_STRIPE_ERROR,
      ),
    );

    return {
      clientSecret: setupIntent.client_secret,
      paymentIntentType: 'setup',
    };
  }

  // A failed earlier attempt leaves an incomplete subscription; it must not
  // count, or a retry would be charged immediately instead of getting the
  // trial. Only a real (non-incomplete) subscription blocks a new trial.
  private isCustomerEligibleForTrialPeriod(
    customer: BillingCustomerEntity | null,
  ): boolean {
    return (
      !isDefined(customer) ||
      !customer.billingSubscriptions.some(
        (subscription) =>
          subscription.status !== SubscriptionStatus.Incomplete &&
          subscription.status !== SubscriptionStatus.IncompleteExpired,
      )
    );
  }

  private async findResumableSubscriptionPaymentIntent(
    customer: BillingCustomerEntity | null,
  ): Promise<{ clientSecret: string; paymentIntentType: string } | null> {
    const existingSubscription = customer?.billingSubscriptions?.find(
      (subscription) => subscription.status !== SubscriptionStatus.Canceled,
    );

    if (!isDefined(existingSubscription)) {
      return null;
    }

    const stripeSubscription =
      await this.stripeCheckoutService.retrieveSubscriptionForResume(
        existingSubscription.stripeSubscriptionId,
      );

    const paymentIntent = this.findSubscriptionClientSecret(stripeSubscription);

    if (isDefined(paymentIntent)) {
      return paymentIntent;
    }

    if (
      stripeSubscription.status === 'incomplete' ||
      stripeSubscription.status === 'incomplete_expired'
    ) {
      return null;
    }

    throw new BillingException(
      'Customer already has a non-canceled billing subscription',
      BillingExceptionCode.BILLING_SUBSCRIPTION_INVALID,
    );
  }

  private extractSubscriptionClientSecret(subscription: Stripe.Subscription): {
    clientSecret: string;
    paymentIntentType: string;
  } {
    const paymentIntent = this.findSubscriptionClientSecret(subscription);

    if (!isDefined(paymentIntent)) {
      throw new BillingException(
        'Error: missing subscription client secret',
        BillingExceptionCode.BILLING_STRIPE_ERROR,
      );
    }

    return paymentIntent;
  }

  private findSubscriptionClientSecret(subscription: Stripe.Subscription): {
    clientSecret: string;
    paymentIntentType: string;
  } | null {
    const pendingSetupIntent = subscription.pending_setup_intent;

    if (
      isDefined(pendingSetupIntent) &&
      typeof pendingSetupIntent !== 'string' &&
      isDefined(pendingSetupIntent.client_secret)
    ) {
      return {
        clientSecret: pendingSetupIntent.client_secret,
        paymentIntentType: 'setup',
      };
    }

    const latestInvoice = subscription.latest_invoice;
    const confirmationSecret =
      isDefined(latestInvoice) && typeof latestInvoice !== 'string'
        ? latestInvoice.confirmation_secret
        : undefined;

    if (
      isDefined(confirmationSecret) &&
      isDefined(confirmationSecret.client_secret)
    ) {
      return {
        clientSecret: confirmationSecret.client_secret,
        paymentIntentType: 'payment',
      };
    }

    return null;
  }

  private async prepareSubscriptionParameters({
    workspace,
    billingPricesPerPlan,
    successUrlPath,
  }: {
    workspace: WorkspaceEntity;
    billingPricesPerPlan: BillingGetPricesPerPlanResult;
    successUrlPath?: string;
  }) {
    const frontBaseUrl = this.workspaceDomainsService.buildWorkspaceURL({
      workspace,
    });
    const cancelUrl = frontBaseUrl.toString();

    if (successUrlPath) {
      frontBaseUrl.pathname = successUrlPath;
    }
    const successUrl = frontBaseUrl.toString();

    const quantity = await this.userWorkspaceRepository.countBy({
      workspaceId: workspace.id,
    });

    const customer = await this.billingCustomerRepository.findOne(
      workspace.id,
      {
        where: {},
        relations: ['billingSubscriptions'],
      },
    );

    const stripeSubscriptionLineItems = this.getStripeSubscriptionLineItems({
      quantity,
      billingPricesPerPlan,
      workspaceId: workspace.id,
    });

    return {
      successUrl,
      cancelUrl,
      quantity,
      customer,
      stripeSubscriptionLineItems,
    };
  }

  async computeBillingPortalSessionURLOrThrow(
    workspace: WorkspaceEntity,
    returnUrlPath?: string,
    forPaymentMethodUpdate?: boolean,
  ) {
    const lastSubscription = await this.billingSubscriptionRepository.findOne(
      workspace.id,
      {
        where: { status: Not(SubscriptionStatus.Canceled) },
        order: { createdAt: 'DESC' },
      },
    );

    if (!lastSubscription) {
      throw new Error('Error: missing subscription');
    }

    const stripeCustomerId = lastSubscription.stripeCustomerId;

    if (!stripeCustomerId) {
      throw new Error('Error: missing stripeCustomerId');
    }

    const returnUrl = this.buildReturnUrl(workspace, returnUrlPath);

    const session = forPaymentMethodUpdate
      ? await this.stripeBillingPortalService.createBillingPortalSessionForPaymentMethodUpdate(
          stripeCustomerId,
          returnUrl,
        )
      : await this.stripeBillingPortalService.createBillingPortalSession(
          stripeCustomerId,
          returnUrl,
        );

    assertIsDefinedOrThrow(
      session.url,
      new BillingException(
        'Error: missing billingPortal.session.url',
        BillingExceptionCode.BILLING_STRIPE_ERROR,
      ),
    );

    return session.url;
  }

  async computeBillingPortalSessionURLForPaymentMethodUpdate(
    workspace: WorkspaceEntity,
    stripeCustomerId: string,
    returnUrlPath?: string,
  ) {
    const returnUrl = this.buildReturnUrl(workspace, returnUrlPath);

    const session =
      await this.stripeBillingPortalService.createBillingPortalSessionForPaymentMethodUpdate(
        stripeCustomerId,
        returnUrl,
      );

    assertIsDefinedOrThrow(
      session.url,
      new BillingException(
        'Error: missing billingPortal.session.url',
        BillingExceptionCode.BILLING_STRIPE_ERROR,
      ),
    );

    return session.url;
  }

  private buildReturnUrl(workspace: WorkspaceEntity, returnUrlPath?: string) {
    const frontBaseUrl = this.workspaceDomainsService.buildWorkspaceURL({
      workspace,
    });

    if (!isDefined(returnUrlPath)) {
      return frontBaseUrl.toString();
    }

    const resolvedUrl = new URL(returnUrlPath, frontBaseUrl);

    if (resolvedUrl.origin !== frontBaseUrl.origin) {
      return frontBaseUrl.toString();
    }

    return resolvedUrl.toString();
  }

  private getDefaultResourceCreditPrice(
    billingPricesPerPlan: BillingGetPricesPerPlanResult,
  ) {
    const resourceCreditPrices =
      billingPricesPerPlan.resourceCreditProductPrices;

    if (!isDefined(resourceCreditPrices) || resourceCreditPrices.length === 0) {
      throw new BillingException(
        'Missing Default RESOURCE_CREDIT price',
        BillingExceptionCode.BILLING_PRICE_NOT_FOUND,
      );
    }

    return resourceCreditPrices.reduce((lowest, price) => {
      const amount = Number(price.metadata?.credit_amount ?? 0);
      const lowestAmount = Number(lowest.metadata?.credit_amount ?? 0);

      return amount < lowestAmount ? price : lowest;
    });
  }

  private getStripeSubscriptionLineItems({
    quantity,
    billingPricesPerPlan,
  }: {
    quantity: number;
    billingPricesPerPlan: BillingGetPricesPerPlanResult;
    workspaceId: string;
  }): Stripe.Checkout.SessionCreateParams.LineItem[] {
    const defaultBaseProductPrice = findOrThrow(
      billingPricesPerPlan.baseProductPrices,
      (baseProductPrice) =>
        baseProductPrice.billingProduct?.metadata.productKey ===
        BillingProductKey.BASE_PRODUCT,
      new BillingException(
        `Base product not found`,
        BillingExceptionCode.BILLING_PRICE_NOT_FOUND,
      ),
    );

    const defaultResourceCreditPrice =
      this.getDefaultResourceCreditPrice(billingPricesPerPlan);

    return [
      {
        price: defaultBaseProductPrice.stripePriceId,
        quantity,
      },
      {
        price: defaultResourceCreditPrice.stripePriceId,
        quantity: 1,
      },
    ];
  }
}
