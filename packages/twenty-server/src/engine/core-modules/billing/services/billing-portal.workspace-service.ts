/* @license Enterprise */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { isDefined } from 'class-validator';
import Stripe from 'stripe';
import { Repository } from 'typeorm';

import {
  BillingException,
  BillingExceptionCode,
} from 'src/engine/core-modules/billing/billing.exception';
import { BillingSubscription } from 'src/engine/core-modules/billing/entities/billing-subscription.entity';
import { AvailableProduct } from 'src/engine/core-modules/billing/enums/billing-available-product.enum';
import { BillingPlanKey } from 'src/engine/core-modules/billing/enums/billing-plan-key.enum';
import { SubscriptionInterval } from 'src/engine/core-modules/billing/enums/billing-subscription-interval.enum';
import { BillingPlanService } from 'src/engine/core-modules/billing/services/billing-plan.service';
import { StripeBillingPortalService } from 'src/engine/core-modules/billing/stripe/services/stripe-billing-portal.service';
import { StripeCheckoutService } from 'src/engine/core-modules/billing/stripe/services/stripe-checkout.service';
import { StripeCustomerService } from 'src/engine/core-modules/billing/stripe/services/stripe-customer.service';
import { StripePriceService } from 'src/engine/core-modules/billing/stripe/services/stripe-price.service';
import { StripeSubscriptionService } from 'src/engine/core-modules/billing/stripe/services/stripe-subscription.service';
import { BillingGetPricesPerPlanResult } from 'src/engine/core-modules/billing/types/billing-get-prices-per-plan-result.type';
import { BillingPortalCheckoutSessionParameters } from 'src/engine/core-modules/billing/types/billing-portal-checkout-session-parameters.type';
import { BillingWebhookSubscriptionService } from 'src/engine/core-modules/billing/webhooks/services/billing-webhook-subscription.service';
import { DomainManagerService } from 'src/engine/core-modules/domain-manager/services/domain-manager.service';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { FeatureFlagKey } from 'src/engine/core-modules/feature-flag/enums/feature-flag-key.enum';
import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { UserWorkspace } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { User } from 'src/engine/core-modules/user/user.entity';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import { assert } from 'src/utils/assert';

@Injectable()
export class BillingPortalWorkspaceService {
  protected readonly logger = new Logger(BillingPortalWorkspaceService.name);
  constructor(
    private readonly stripeCheckoutService: StripeCheckoutService,
    private readonly stripeBillingPortalService: StripeBillingPortalService,
    private readonly stripeCustomerService: StripeCustomerService,
    private readonly stripeSubscriptionService: StripeSubscriptionService,
    private readonly stripePriceService: StripePriceService,
    private readonly billingPlanService: BillingPlanService,
    private readonly billingWebhookSubscriptionService: BillingWebhookSubscriptionService,
    private readonly domainManagerService: DomainManagerService,
    private readonly featureFlagService: FeatureFlagService,
    private readonly environmentService: EnvironmentService,
    @InjectRepository(BillingSubscription, 'core')
    private readonly billingSubscriptionRepository: Repository<BillingSubscription>,
    @InjectRepository(UserWorkspace, 'core')
    private readonly userWorkspaceRepository: Repository<UserWorkspace>,
  ) {}

  async computeCheckoutSessionURL({
    user,
    workspace,
    billingPricesPerPlan,
    successUrlPath,
    plan,
    priceId,
    requirePaymentMethod,
  }: BillingPortalCheckoutSessionParameters): Promise<string> {
    const frontBaseUrl = this.domainManagerService.buildWorkspaceURL({
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

    const subscription = await this.billingSubscriptionRepository.findOneBy({
      workspaceId: workspace.id,
    });

    const stripeCustomerId = subscription?.stripeCustomerId;
    const isBillingPlansEnabled =
      await this.featureFlagService.isFeatureEnabled(
        FeatureFlagKey.IsBillingPlansEnabled,
        workspace.id,
      );

    const stripeSubscriptionLineItems =
      await this.getStripeSubscriptionLineItems({
        quantity,
        isBillingPlansEnabled,
        billingPricesPerPlan,
        priceId,
      });

    const checkoutSession =
      await this.stripeCheckoutService.createCheckoutSession({
        user,
        workspaceId: workspace.id,
        stripeSubscriptionLineItems,
        successUrl,
        cancelUrl,
        stripeCustomerId: stripeCustomerId ?? undefined,
        plan,
        requirePaymentMethod,
        withTrialPeriod: !isDefined(subscription),
        isBillingPlansEnabled,
      });

    assert(checkoutSession.url, 'Error: missing checkout.session.url');

    return checkoutSession.url;
  }

  getBillingProvider(): 'stripe' | 'razorpay' {
    const provider = (
      this.environmentService as { get(key: string): unknown }
    ).get('BILLING_PROVIDER');
    return (provider === 'razorpay' ? 'razorpay' : 'stripe') as 'stripe' | 'razorpay';
  }

  async computeBillingPortalSessionURLOrThrow(
    workspace: Workspace,
    returnUrlPath?: string,
  ) {
    const provider = this.getBillingProvider();
    const frontBaseUrl = this.domainManagerService.buildWorkspaceURL({
      workspace,
    });
    if (returnUrlPath) {
      frontBaseUrl.pathname = returnUrlPath;
    }
    const returnUrl = frontBaseUrl.toString();

    if (provider === 'razorpay') {
      return returnUrl;
    }

    const lastSubscription = await this.billingSubscriptionRepository.findOne({
      where: { workspaceId: workspace.id },
      order: { createdAt: 'DESC' },
    });

    if (!lastSubscription) {
      throw new Error('Error: missing subscription');
    }

    const stripeCustomerId = lastSubscription.stripeCustomerId;

    if (!stripeCustomerId) {
      throw new Error('Error: missing stripeCustomerId');
    }

    const session =
      await this.stripeBillingPortalService.createBillingPortalSession(
        stripeCustomerId,
        returnUrl,
      );

    assert(session.url, 'Error: missing billingPortal.session.url');

    return session.url;
  }

  private getStripeSubscriptionLineItems({
    quantity,
    isBillingPlansEnabled,
    billingPricesPerPlan,
    priceId,
  }: {
    quantity: number;
    isBillingPlansEnabled: boolean;
    billingPricesPerPlan?: BillingGetPricesPerPlanResult;
    priceId?: string;
  }): Stripe.Checkout.SessionCreateParams.LineItem[] {
    if (isBillingPlansEnabled && billingPricesPerPlan) {
      return [
        {
          price: billingPricesPerPlan.baseProductPrice.stripePriceId,
          quantity,
        },
        ...billingPricesPerPlan.meteredProductsPrices.map((price) => ({
          price: price.stripePriceId,
        })),
      ];
    }

    if (priceId && !isBillingPlansEnabled) {
      return [{ price: priceId, quantity }];
    }

    throw new BillingException(
      isBillingPlansEnabled
        ? 'Missing Billing prices per plan'
        : 'Missing price id',
      BillingExceptionCode.BILLING_PRICE_NOT_FOUND,
    );
  }

  /**
   * Creates a 7-day trial subscription (no credit card) for the workspace
   * so the user can skip the "Choose your trial" page and go straight to Create Workspace.
   * Idempotent: if workspace already has a subscription, returns without error.
   * Uses getOrCreateCustomer and checks Stripe for active subscriptions to avoid duplicates
   * when startTrial is called concurrently (e.g. double-click or two tabs).
   */
  async startTrialForWorkspace({
    user,
    workspace,
  }: {
    user: User;
    workspace: Workspace;
  }): Promise<{ started: boolean }> {
    const existingSubscription =
      await this.billingSubscriptionRepository.findOneBy({
        workspaceId: workspace.id,
      });

    if (existingSubscription) {
      return { started: false };
    }

    const hasActiveInStripe =
      await this.stripeSubscriptionService.hasActiveSubscriptionForWorkspace(
        workspace.id,
      );
    if (hasActiveInStripe) {
      return { started: false };
    }

    const trialPeriodDays = this.environmentService.get(
      'BILLING_FREE_TRIAL_WITHOUT_CREDIT_CARD_DURATION_IN_DAYS',
    );
    const quantity = await this.userWorkspaceRepository.countBy({
      workspaceId: workspace.id,
    });
    const quantityOrOne = Math.max(quantity, 1);

    const stripeCustomer =
      await this.stripeCustomerService.getOrCreateCustomer({
        email: user.email,
        workspaceId: workspace.id,
      });

    let priceId: string;
    const isBillingPlansEnabled =
      await this.featureFlagService.isFeatureEnabled(
        FeatureFlagKey.IsBillingPlansEnabled,
        workspace.id,
      );

    if (isBillingPlansEnabled) {
      const billingPricesPerPlan =
        await this.billingPlanService.getPricesPerPlan({
          planKey: BillingPlanKey.PRO,
          interval: SubscriptionInterval.Month,
        });
      priceId = billingPricesPerPlan.baseProductPrice.stripePriceId;
    } else {
      const productPrice = await this.stripePriceService.getStripePrice(
        AvailableProduct.BasePlan,
        SubscriptionInterval.Month,
      );
      if (!productPrice) {
        throw new BillingException(
          'Product price not found for trial',
          BillingExceptionCode.BILLING_PRICE_NOT_FOUND,
        );
      }
      priceId = productPrice.stripePriceId;
    }

    const subscription =
      await this.stripeSubscriptionService.createSubscriptionWithTrial({
        stripeCustomerId: stripeCustomer.id,
        priceId,
        quantity: quantityOrOne,
        workspaceId: workspace.id,
        plan: BillingPlanKey.PRO,
        trialPeriodDays,
      });

    const expandedSubscription =
      await this.stripeSubscriptionService.retrieveSubscription(
        subscription.id,
        ['items.data.price'],
      );

    await this.billingWebhookSubscriptionService.processStripeEvent(
      workspace.id,
      {
        object: expandedSubscription,
      } as Stripe.CustomerSubscriptionCreatedEvent.Data,
    );

    await this.stripeCustomerService.updateCustomerMetadataWorkspaceId(
      stripeCustomer.id,
      workspace.id,
    );

    return { started: true };
  }
}
