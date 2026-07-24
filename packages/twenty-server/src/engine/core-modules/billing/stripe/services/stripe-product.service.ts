/* @license Enterprise */

import { Injectable, Logger } from '@nestjs/common';

import type Stripe from 'stripe';

import { StripeSDKService } from 'src/engine/core-modules/billing/stripe/stripe-sdk/services/stripe-sdk.service';
import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

@Injectable()
export class StripeProductService {
  protected readonly logger = new Logger(StripeProductService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly twentyConfigService: TwentyConfigService,
    private readonly stripeSDKService: StripeSDKService,
  ) {
    if (!this.twentyConfigService.get('IS_BILLING_ENABLED')) {
      return;
    }
    this.stripe = this.stripeSDKService.getStripe(
      this.twentyConfigService.get('BILLING_STRIPE_API_KEY'),
    );
  }

  async getAllProducts() {
    const products: Stripe.Product[] = [];

    for await (const product of this.stripe.products.list({
      active: true,
      limit: 100,
    })) {
      products.push(product);
    }

    return products;
  }

  async getProductById(productId: string) {
    return this.stripe.products.retrieve(productId);
  }

  async createProduct({
    name,
    metadata,
  }: {
    name: string;
    metadata: Stripe.MetadataParam;
  }) {
    return this.stripe.products.create({
      name,
      metadata,
    });
  }

  async updateProductMetadata({
    productId,
    metadata,
  }: {
    productId: string;
    metadata: Stripe.MetadataParam;
  }) {
    return this.stripe.products.update(productId, {
      metadata,
    });
  }
}
