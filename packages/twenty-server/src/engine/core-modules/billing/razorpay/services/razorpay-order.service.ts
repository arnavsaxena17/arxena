/* @license Enterprise */

import { Injectable, Logger } from '@nestjs/common';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import {
  RAZORPAY_CREDIT_PACKS,
  type CreditPackKey,
} from 'src/engine/core-modules/billing/razorpay/constants/credit-packs.constant';

type OrderNotes = {
  workspaceId?: string;
  creditPackKey?: string;
};

export type CreateOrderForCreditsResult = {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
};

@Injectable()
export class RazorpayOrderService {
  protected readonly logger = new Logger(RazorpayOrderService.name);

  constructor(private readonly environmentService: EnvironmentService) {}

  async createOrderForCredits(
    workspaceId: string,
    creditPackKey: CreditPackKey,
  ): Promise<CreateOrderForCreditsResult> {
    const pack = RAZORPAY_CREDIT_PACKS.find((p) => p.key === creditPackKey);
    if (!pack) {
      throw new Error(`Unknown credit pack: ${creditPackKey}`);
    }
    const keyId = this.environmentService.get('BILLING_RAZORPAY_KEY_ID');
    const keySecret = this.environmentService.get(
      'BILLING_RAZORPAY_KEY_SECRET',
    );
    if (!keyId || !keySecret) {
      throw new Error('Razorpay credentials not configured');
    }
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: pack.amountSubunits,
        currency: pack.currency,
        notes: {
          workspaceId,
          creditPackKey: pack.key,
        },
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      this.logger.error(`Razorpay create order failed: ${res.status} ${errText}`);
      throw new Error(`Razorpay create order failed: ${res.status}`);
    }
    const data = (await res.json()) as { id: string; amount: number; currency: string };
    return {
      orderId: data.id,
      amount: data.amount,
      currency: data.currency,
      keyId,
    };
  }

  async getOrderNotes(orderId: string): Promise<OrderNotes | null> {
    const keyId = this.environmentService.get('BILLING_RAZORPAY_KEY_ID');
    const keySecret = this.environmentService.get(
      'BILLING_RAZORPAY_KEY_SECRET',
    );
    if (!keyId || !keySecret) {
      return null;
    }
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const url = `https://api.razorpay.com/v1/orders/${orderId}`;
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });
      if (!res.ok) {
        this.logger.warn(`Razorpay order fetch failed: ${res.status}`);
        return null;
      }
      const data = (await res.json()) as { notes?: Record<string, string> };
      const notes = data?.notes;
      if (!notes) return null;
      return {
        workspaceId: notes.workspaceId,
        creditPackKey: notes.creditPackKey,
      };
    } catch (err) {
      this.logger.warn(`Razorpay getOrderNotes error: ${err}`);
      return null;
    }
  }
}
