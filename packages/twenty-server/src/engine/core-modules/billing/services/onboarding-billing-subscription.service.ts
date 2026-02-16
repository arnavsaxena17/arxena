/* @license Enterprise */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { BillingCustomer } from 'src/engine/core-modules/billing/entities/billing-customer.entity';
import { BillingSubscription } from 'src/engine/core-modules/billing/entities/billing-subscription.entity';
import { AvailableProduct } from 'src/engine/core-modules/billing/enums/billing-available-product.enum';
import { SubscriptionInterval } from 'src/engine/core-modules/billing/enums/billing-subscription-interval.enum';
import { RazorpayCustomerService } from 'src/engine/core-modules/billing/razorpay/services/razorpay-customer.service';
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
    private readonly razorpayCustomerService: RazorpayCustomerService,
    @InjectRepository(BillingSubscription, 'core')
    private readonly billingSubscriptionRepository: Repository<BillingSubscription>,
    @InjectRepository(BillingCustomer, 'core')
    private readonly billingCustomerRepository: Repository<BillingCustomer>,
  ) {}

  /**
   * Creates Stripe and/or Razorpay customers for a new workspace; when Stripe keys are set,
   * also creates a Stripe subscription with trial. Idempotent: no-op if workspace already has a subscription.
   * Persistence: BillingCustomer is upserted here; Stripe subscription events are handled by webhook.
   */
  async createCustomerAndSubscriptionForOnboarding({
    workspaceId,
    userEmail,
    userName,
  }: {
    workspaceId: string;
    userEmail: string;
    userName?: string;
  }): Promise<void> {
    const existingSubscription = await this.billingSubscriptionRepository.findOne({
      where: { workspaceId },
    });
    if (existingSubscription) {
      this.logger.log(
        `Workspace ${workspaceId} already has a subscription, skipping onboarding billing creation`,
      );
      return;
    }

    let stripeCustomerId: string | null = null;
    const stripeKeyId = this.environmentService.get('BILLING_STRIPE_API_KEY');
    if (stripeKeyId) {
      const productPrice = await this.stripePriceService.getStripePrice(
        AvailableProduct.BasePlan,
        SubscriptionInterval.Month,
      );
      if (productPrice) {
        const trialPeriodDays = this.environmentService.get(
          'BILLING_FREE_TRIAL_WITHOUT_CREDIT_CARD_DURATION_IN_DAYS',
        );
        const customer = await this.stripeCustomerService.createCustomer(
          userEmail,
          workspaceId,
        );
        stripeCustomerId = customer.id;
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

    let razorpayCustomerId: string | null = null;
    const razorpayKeyId = this.environmentService.get('BILLING_RAZORPAY_KEY_ID');
    if (razorpayKeyId) {
      try {
        const { id } = await this.razorpayCustomerService.createCustomer(
          userEmail,
          workspaceId,
          userName,
        );
        razorpayCustomerId = id;
        this.logger.log(
          `Created Razorpay customer for workspace ${workspaceId}`,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to create Razorpay customer for workspace ${workspaceId}: ${err}`,
        );
      }
    }

    if (stripeCustomerId ?? razorpayCustomerId) {
      const existing = await this.billingCustomerRepository.findOne({
        where: { workspaceId },
      });
      const toSave = existing ?? this.billingCustomerRepository.create({ workspaceId });
      if (stripeCustomerId != null) toSave.stripeCustomerId = stripeCustomerId;
      if (razorpayCustomerId != null) toSave.razorpayCustomerId = razorpayCustomerId;
      toSave.paymentProvider =
        (this.environmentService.get('BILLING_PROVIDER') as 'stripe' | 'razorpay') ?? 'stripe';
      await this.billingCustomerRepository.save(toSave);
    }
  }
}
