/* @license Enterprise */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { BillingSubscription } from 'src/engine/core-modules/billing/entities/billing-subscription.entity';
import { AvailableProduct } from 'src/engine/core-modules/billing/enums/billing-available-product.enum';
import { SubscriptionInterval } from 'src/engine/core-modules/billing/enums/billing-subscription-interval.enum';
import { StripeCustomerService } from 'src/engine/core-modules/billing/stripe/services/stripe-customer.service';
import { StripePriceService } from 'src/engine/core-modules/billing/stripe/services/stripe-price.service';
import { StripeSubscriptionService } from 'src/engine/core-modules/billing/stripe/services/stripe-subscription.service';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

@Injectable()
export class OnboardingBillingSubscriptionService {
  protected readonly logger = new Logger(
    OnboardingBillingSubscriptionService.name,
  );

  constructor(
    private readonly environmentService: EnvironmentService,
    private readonly stripeCustomerService: StripeCustomerService,
    private readonly stripePriceService: StripePriceService,
    private readonly stripeSubscriptionService: StripeSubscriptionService,
    @InjectRepository(BillingSubscription, 'core')
    private readonly billingSubscriptionRepository: Repository<BillingSubscription>,
  ) {}

  /**
   * Creates a Stripe customer and subscription with 7-day trial (no credit card) for a new workspace.
   * Idempotent: no-op if workspace already has a subscription.
   * Stripe will send customer.subscription.created webhook; persistence is handled by the webhook.
   */
  async createCustomerAndSubscriptionForOnboarding({
    workspaceId,
    userEmail,
  }: {
    workspaceId: string;
    userEmail: string;
  }): Promise<void> {
    const existing = await this.billingSubscriptionRepository.findOne({
      where: { workspaceId },
    });
    if (existing) {
      this.logger.log(
        `Workspace ${workspaceId} already has a subscription, skipping onboarding billing creation`,
      );
      return;
    }

    const productPrice = await this.stripePriceService.getStripePrice(
      AvailableProduct.BasePlan,
      SubscriptionInterval.Month,
    );
    if (!productPrice) {
      this.logger.warn(
        `No Stripe price found for ${AvailableProduct.BasePlan} / ${SubscriptionInterval.Month}, skipping onboarding billing`,
      );
      return;
    }

    const trialPeriodDays = this.environmentService.get(
      'BILLING_FREE_TRIAL_WITHOUT_CREDIT_CARD_DURATION_IN_DAYS',
    );

    const customer = await this.stripeCustomerService.createCustomer(
      userEmail,
      workspaceId,
    );

    await this.stripeSubscriptionService.createSubscriptionWithTrial({
      stripeCustomerId: customer.id,
      priceId: productPrice.stripePriceId,
      workspaceId,
      trialPeriodDays,
    });

    this.logger.log(
      `Created Stripe customer and subscription with ${trialPeriodDays}-day trial for workspace ${workspaceId}`,
    );
  }
}
