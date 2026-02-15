/* @license Enterprise */

import { Injectable, Logger } from '@nestjs/common';

import Razorpay from 'razorpay';

import {
  RAZORPAY_CREDIT_PACKS,
  type CreditPackKey,
} from 'src/engine/core-modules/billing/razorpay/constants/credit-packs.constant';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

export type CreateOrderForCreditsResult = {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  creditPackKey: CreditPackKey;
  credits: number;
};

@Injectable()
export class RazorpayOrderService {
  protected readonly logger = new Logger(RazorpayOrderService.name);
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
   * Fetch order notes (workspaceId, creditPackKey) for payment.captured webhook.
   * Notes are set on order creation; payment entity in webhook does not include them.
   */
  async getOrderNotes(orderId: string): Promise<{
    workspaceId?: string;
    creditPackKey?: string;
  } | null> {
    try {
      const order = await this.getRazorpay().orders.fetch(orderId);
      const notes = order?.notes as Record<string, string> | undefined;
      if (!notes) return null;
      return {
        workspaceId: typeof notes.workspaceId === 'string' ? notes.workspaceId : undefined,
        creditPackKey: typeof notes.creditPackKey === 'string' ? notes.creditPackKey : undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Razorpay SDK uses axios; errors may be Error or { response: { data: { error: { description } } } }.
   */
  private normalizeRazorpayErrorMessage(err: unknown): string {
    if (err instanceof Error) {
      const msg = err.message;
      if (msg && msg !== 'Unknown Razorpay error') return msg;
    }
    const ax = err as { response?: { data?: unknown; status?: number } };
    if (ax?.response?.data != null) {
      const data = ax.response.data as { error?: { description?: string; code?: string }; description?: string };
      const description = data?.error?.description ?? data?.description;
      if (typeof description === 'string') return description;
      if (data?.error?.code) return `${data.error.code}: ${String(description ?? '')}`.trim();
    }
    if (ax?.response?.status != null) {
      return `HTTP ${ax.response.status}`;
    }
    return typeof err === 'object' && err !== null ? JSON.stringify(err) : String(err);
  }

  /**
   * Create a Razorpay Order for one-time credit pack purchase.
   * Frontend uses orderId and keyId to open Razorpay Standard Checkout.
   */
  async createOrderForCredits(
    workspaceId: string,
    creditPackKey: CreditPackKey,
    currency = 'USD',
  ): Promise<CreateOrderForCreditsResult> {
    const pack = RAZORPAY_CREDIT_PACKS.find((p) => p.key === creditPackKey);
    if (!pack) {
      throw new Error(`Unknown credit pack: ${creditPackKey}`);
    }

    const keyId = this.environmentService.get('BILLING_RAZORPAY_KEY_ID') as string | undefined;
    if (typeof keyId !== 'string' || !keyId) {
      throw new Error('BILLING_RAZORPAY_KEY_ID is not set');
    }

    let order: { id?: string };
    try {
      order = await this.getRazorpay().orders.create({
        amount: pack.amountSubunits,
        currency,
        notes: { workspaceId, creditPackKey },
        receipt: `credits_${workspaceId.replace(/-/g, '').slice(0, 12)}_${Date.now()}`,
      });
    } catch (err) {
      const message = this.normalizeRazorpayErrorMessage(err);
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.warn(
        `Razorpay orders.create failed: ${message}${stack ? `\n${stack}` : ''}`,
      );
      throw new Error(`Failed to create Razorpay order: ${message}`);
    }

    const orderId =
      typeof order?.id === 'string' ? order.id : null;
    if (!orderId) {
      this.logger.warn(
        `Razorpay orders.create returned order without id: ${JSON.stringify(order)}`,
      );
      throw new Error(
        'Razorpay order creation did not return an order id. Please try again or contact support.',
      );
    }

    return {
      orderId,
      amount: pack.amountSubunits,
      currency: pack.currency,
      keyId: String(keyId),
      creditPackKey: pack.key,
      credits: pack.credits,
    };
  }
}
