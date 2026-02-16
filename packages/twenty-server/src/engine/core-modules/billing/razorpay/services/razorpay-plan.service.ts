/* @license Enterprise */

import { Injectable, Logger } from '@nestjs/common';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

export type RazorpayPlan = {
  id: string;
  entity: string;
  interval: number;
  period: string;
  item: {
    id: string;
    name: string;
    amount: number;
    currency: string;
    description?: string;
  };
};

type RazorpayPlansResponse = {
  entity: string;
  count: number;
  items: RazorpayPlan[];
};

@Injectable()
export class RazorpayPlanService {
  protected readonly logger = new Logger(RazorpayPlanService.name);

  constructor(private readonly environmentService: EnvironmentService) {}

  async getAllPlans(): Promise<RazorpayPlan[]> {
    const keyId = this.environmentService.get('BILLING_RAZORPAY_KEY_ID');
    const keySecret = this.environmentService.get(
      'BILLING_RAZORPAY_KEY_SECRET',
    );
    if (!keyId || !keySecret) {
      this.logger.warn('Razorpay credentials not configured; skipping plans fetch');
      return [];
    }
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const res = await fetch('https://api.razorpay.com/v1/plans', {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });
    if (!res.ok) {
      const errText = await res.text();
      this.logger.error(
        `Razorpay fetch plans failed: ${res.status} ${errText}`,
      );
      throw new Error(`Razorpay fetch plans failed: ${res.status}`);
    }
    const data = (await res.json()) as RazorpayPlansResponse;
    return data.items ?? [];
  }

  async getSubscriptionShortUrl(
    subscriptionId: string,
  ): Promise<string | null> {
    const keyId = this.environmentService.get('BILLING_RAZORPAY_KEY_ID');
    const keySecret = this.environmentService.get(
      'BILLING_RAZORPAY_KEY_SECRET',
    );
    if (!keyId || !keySecret) {
      return null;
    }
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const res = await fetch(
      `https://api.razorpay.com/v1/subscriptions/${subscriptionId}`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { short_url?: string };
    return data.short_url ?? null;
  }

  async getSubscriptionPlanId(
    subscriptionId: string,
  ): Promise<string | null> {
    const keyId = this.environmentService.get('BILLING_RAZORPAY_KEY_ID');
    const keySecret = this.environmentService.get(
      'BILLING_RAZORPAY_KEY_SECRET',
    );
    if (!keyId || !keySecret) {
      return null;
    }
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const res = await fetch(
      `https://api.razorpay.com/v1/subscriptions/${subscriptionId}`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { plan_id?: string };
    return data.plan_id ?? null;
  }

  /** Fetch plan by id from Razorpay; returns item.name as display name. */
  async getPlanName(planId: string): Promise<string | null> {
    const keyId = this.environmentService.get('BILLING_RAZORPAY_KEY_ID');
    const keySecret = this.environmentService.get(
      'BILLING_RAZORPAY_KEY_SECRET',
    );
    if (!keyId || !keySecret) {
      return null;
    }
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const res = await fetch(`https://api.razorpay.com/v1/plans/${planId}`, {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as RazorpayPlan;
    return data?.item?.name ?? null;
  }
}
