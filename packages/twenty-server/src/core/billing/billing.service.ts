import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import Stripe from 'stripe';
import { Repository } from 'typeorm';

import { EnvironmentService } from 'src/integrations/environment/environment.service';
import { StripeService } from 'src/core/billing/stripe/stripe.service';
import { BillingSubscription } from 'src/core/billing/entities/billing-subscription.entity';
import { BillingSubscriptionItem } from 'src/core/billing/entities/billing-subscription-item.entity';
import { Workspace } from 'src/core/workspace/workspace.entity';

export type PriceData = Partial<
  Record<Stripe.Price.Recurring.Interval, Stripe.Price>
>;
export enum AvailableProduct {
  BasePlan = 'base-plan',
}
export enum RecurringInterval {
  MONTH = 'month',
  YEAR = 'year',
}

export enum WebhookEvent {
  CUSTOMER_SUBSCRIPTION_UPDATED = 'customer.subscription.updated',
}

@Injectable()
export class BillingService {
  constructor(
    private readonly stripeService: StripeService,
    private readonly environmentService: EnvironmentService,
    @InjectRepository(BillingSubscription, 'core')
    private readonly billingSubscriptionRepository: Repository<BillingSubscription>,
    @InjectRepository(BillingSubscriptionItem, 'core')
    private readonly billingSubscriptionItemRepository: Repository<BillingSubscriptionItem>,
    @InjectRepository(Workspace, 'core')
    private readonly workspaceRepository: Repository<Workspace>,
  ) {}

  getProductStripeId(product: AvailableProduct) {
    if (product === AvailableProduct.BasePlan) {
      return this.environmentService.getBillingStripeBasePlanProductId();
    }
  }

  async getProductPrices(stripeProductId: string) {
    const productPrices = await this.stripeService.stripe.prices.search({
      query: `product: '${stripeProductId}'`,
    });

    return this.formatProductPrices(productPrices.data);
  }

  formatProductPrices(prices: Stripe.Price[]) {
    const result: PriceData = {};

    prices.forEach((item) => {
      const recurringInterval = item.recurring?.interval;

      if (!recurringInterval) {
        return;
      }
      if (
        !result[recurringInterval] ||
        item.created > (result[recurringInterval]?.created || 0)
      ) {
        result[recurringInterval] = item;
      }
    });

    return result;
  }

  async createBillingSubscription(
    workspaceId: string,
    data: Stripe.CustomerSubscriptionUpdatedEvent.Data,
  ) {
    const billingSubscription = this.billingSubscriptionRepository.create({
      workspaceId: workspaceId,
      stripeCustomerId: data.object.customer as string,
      stripeSubscriptionId: data.object.id,
      status: data.object.status,
    });

    await this.billingSubscriptionRepository.save(billingSubscription);

    for (const item of data.object.items.data) {
      const billingSubscriptionItem =
        this.billingSubscriptionItemRepository.create({
          billingSubscriptionId: billingSubscription.id,
          stripeProductId: item.price.product as string,
          stripePriceId: item.price.id,
          quantity: item.quantity,
        });

      await this.billingSubscriptionItemRepository.save(
        billingSubscriptionItem,
      );
    }
    await this.workspaceRepository.update(workspaceId, {
      subscriptionStatus: 'active',
    });
  }
}
