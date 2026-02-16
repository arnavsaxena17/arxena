/* @license Enterprise */

import { Injectable, Logger } from '@nestjs/common';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

type CreateSubscriptionLinkParams = {
  planId: string;
  workspaceId: string;
  quantity?: number;
  totalCount?: number;
  expireBy?: number;
};

type RazorpaySubscriptionResponse = {
  id: string;
  short_url: string;
  status?: string;
};

export type CreateSubscriptionResult = {
  subscriptionId: string;
  shortUrl: string;
};

@Injectable()
export class RazorpayCheckoutService {
  protected readonly logger = new Logger(RazorpayCheckoutService.name);

  constructor(private readonly environmentService: EnvironmentService) {}

  async createSubscription(
    params: CreateSubscriptionLinkParams,
  ): Promise<CreateSubscriptionResult> {
    const keyId = this.environmentService.get('BILLING_RAZORPAY_KEY_ID');
    const keySecret = this.environmentService.get(
      'BILLING_RAZORPAY_KEY_SECRET',
    );
    if (!keyId || !keySecret) {
      throw new Error('Razorpay credentials not configured');
    }
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const body = {
      plan_id: params.planId,
      total_count: params.totalCount ?? 12,
      quantity: params.quantity ?? 1,
      customer_notify: true,
      notes: {
        workspaceId: params.workspaceId,
      },
      ...(params.expireBy && { expire_by: params.expireBy }),
    };
    const res = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      this.logger.error(
        `Razorpay create subscription failed: ${res.status} ${errText}`,
      );
      let message = `Razorpay create subscription failed: ${res.status}`;
      try {
        const errJson = JSON.parse(errText) as {
          error?: { description?: string; code?: string };
        };
        if (errJson?.error?.description) {
          message = errJson.error.description;
        }
      } catch {
        // use default message
      }
      throw new Error(message);
    }
    const data = (await res.json()) as RazorpaySubscriptionResponse;
    if (!data.id || !data.short_url) {
      throw new Error(
        'Razorpay subscription response missing id or short_url',
      );
    }
    return { subscriptionId: data.id, shortUrl: data.short_url };
  }
}
