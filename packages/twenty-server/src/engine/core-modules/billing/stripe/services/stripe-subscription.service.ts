/* @license Enterprise */

import { Injectable, Logger } from '@nestjs/common';

import Stripe from 'stripe';

import { BillingSubscriptionItem } from 'src/engine/core-modules/billing/entities/billing-subscription-item.entity';
import { BillingPlanKey } from 'src/engine/core-modules/billing/enums/billing-plan-key.enum';
import { StripeSDKService } from 'src/engine/core-modules/billing/stripe/stripe-sdk/services/stripe-sdk.service';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

@Injectable()
export class StripeSubscriptionService {
  protected readonly logger = new Logger(StripeSubscriptionService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly environmentService: EnvironmentService,
    private readonly stripeSDKService: StripeSDKService,
  ) {
    if (!this.environmentService.get('IS_BILLING_ENABLED')) {
      return;
    }
    this.stripe = this.stripeSDKService.getStripe(
      this.environmentService.get('BILLING_STRIPE_API_KEY'),
    );
  }

  async createSubscriptionWithTrial({
    stripeCustomerId,
    priceId,
    quantity,
    workspaceId,
    plan = BillingPlanKey.PRO,
    trialPeriodDays,
  }: {
    stripeCustomerId: string;
    priceId: string;
    quantity: number;
    workspaceId: string;
    plan?: BillingPlanKey;
    trialPeriodDays: number;
  }): Promise<Stripe.Subscription> {
    const subscription = await this.stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: priceId, quantity }],
      trial_period_days: trialPeriodDays,
      metadata: { workspaceId, plan },
      payment_settings: {
        save_default_payment_method: 'off',
      },
    });
    return subscription;
  }

  async retrieveSubscription(
    stripeSubscriptionId: string,
    expand?: string[],
  ): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.retrieve(
      stripeSubscriptionId,
      expand ? { expand } : undefined,
    );
  }

  async cancelSubscription(stripeSubscriptionId: string) {
    await this.stripe.subscriptions.cancel(stripeSubscriptionId);
  }

  async getStripeCustomerIdFromWorkspaceId(workspaceId: string) {
    const subscription = await this.stripe.subscriptions.search({
      query: `metadata['workspaceId']:'${workspaceId}'`,
      limit: 1,
    });
    const stripeCustomerId = subscription.data[0].customer
      ? String(subscription.data[0].customer)
      : undefined;

    return stripeCustomerId;
  }

  /**
   * Returns true if Stripe has at least one subscription for this workspace with status
   * trialing, active, or past_due. Used to avoid creating a second trial when two requests race.
   * Stripe search does not allow mixing AND and OR, so we search by workspaceId and filter status in code.
   */
  async hasActiveSubscriptionForWorkspace(workspaceId: string): Promise<boolean> {
    const result = await this.stripe.subscriptions.search({
      query: `metadata['workspaceId']:'${workspaceId}'`,
      limit: 10,
    });
    const activeStatuses = ['trialing', 'active', 'past_due'];
    return result.data.some((sub) => activeStatuses.includes(sub.status ?? ''));
  }

  async collectLastInvoice(stripeSubscriptionId: string) {
    const subscription = await this.stripe.subscriptions.retrieve(
      stripeSubscriptionId,
      { expand: ['latest_invoice'] },
    );
    const latestInvoice = subscription.latest_invoice;

    if (
      !(
        latestInvoice &&
        typeof latestInvoice !== 'string' &&
        latestInvoice.status === 'draft'
      )
    ) {
      return;
    }
    await this.stripe.invoices.pay(latestInvoice.id);
  }

  async updateSubscriptionItems(
    stripeSubscriptionId: string,
    billingSubscriptionItems: BillingSubscriptionItem[],
  ) {
    const stripeSubscriptionItemsToUpdate = billingSubscriptionItems.map(
      (item) => ({
        id: item.stripeSubscriptionItemId,
        price: item.stripePriceId,
        quantity: item.quantity === null ? undefined : item.quantity,
      }),
    );

    await this.stripe.subscriptions.update(stripeSubscriptionId, {
      items: stripeSubscriptionItemsToUpdate,
    });
  }
}
