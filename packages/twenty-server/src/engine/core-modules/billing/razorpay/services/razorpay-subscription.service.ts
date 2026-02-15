/* @license Enterprise */

import { Injectable, Logger } from '@nestjs/common';

import Razorpay from 'razorpay';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

export type CreateSubscriptionLinkParams = {
  planId: string;
  workspaceId: string;
  totalCount: number;
  quantity?: number;
  expireBy?: number;
};

export type CreateSubscriptionLinkResult = {
  subscriptionId: string;
  shortUrl: string;
};

@Injectable()
export class RazorpaySubscriptionService {
  protected readonly logger = new Logger(RazorpaySubscriptionService.name);
  private readonly razorpay: Razorpay | null;

  constructor(private readonly environmentService: EnvironmentService) {
    const keyId = this.environmentService.get('BILLING_RAZORPAY_KEY_ID') as string | undefined;
    const keySecret = this.environmentService.get('BILLING_RAZORPAY_KEY_SECRET') as string | undefined;
    if (typeof keyId === 'string' && typeof keySecret === 'string') {
      this.razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    } else {
      this.razorpay = null;
    }
  }

  private getRazorpay(): Razorpay {
    if (!this.razorpay) {
      throw new Error(
        'Razorpay is not configured (missing BILLING_RAZORPAY_KEY_ID or KEY_SECRET)',
      );
    }
    return this.razorpay;
  }

  /**
   * Create a Razorpay subscription (subscription link). Customer pays via short_url;
   * after payment, subscription is activated and webhooks fire.
   */
  async createSubscriptionLink(
    params: CreateSubscriptionLinkParams,
  ): Promise<CreateSubscriptionLinkResult> {
    const api = this.getRazorpay();
    const subscription = await api.subscriptions.create({
      plan_id: params.planId,
      total_count: params.totalCount,
      quantity: params.quantity ?? 1,
      notes: { workspaceId: params.workspaceId },
      ...(params.expireBy ? { expire_by: params.expireBy } : {}),
    });

    return {
      subscriptionId: subscription.id,
      shortUrl: subscription.short_url,
    };
  }

  async cancelSubscription(subscriptionId: string, cancelAtCycleEnd = false) {
    await this.getRazorpay().subscriptions.cancel(
      subscriptionId,
      cancelAtCycleEnd ? 1 : 0,
    );
  }

  async fetchSubscription(subscriptionId: string) {
    return this.getRazorpay().subscriptions.fetch(subscriptionId);
  }
}
