/* @license Enterprise */

import { Injectable, Logger } from '@nestjs/common';

import Razorpay from 'razorpay';

import {
    RAZORPAY_CREDIT_PACKS,
    type CreditPackKey,
} from 'src/engine/core-modules/billing/razorpay/constants/credit-packs.constant';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

@Injectable()
export class RazorpayPaymentLinkService {
  protected readonly logger = new Logger(RazorpayPaymentLinkService.name);
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
      throw new Error('Razorpay is not configured (missing BILLING_RAZORPAY_KEY_ID or KEY_SECRET)');
    }
    return this.razorpay;
  }

  /**
   * Create one-time payment links for each credit pack (e.g. 5 credits @ 1000 USD, 10 @ 2000 USD).
   * Optional callbackUrl for redirect after payment.
   */
  async createCreditPackPaymentLinks(callbackUrl?: string): Promise<{ key: CreditPackKey; shortUrl: string; id: string }[]> {
    const api = this.getRazorpay();
    const result: { key: CreditPackKey; shortUrl: string; id: string }[] = [];

    for (const pack of RAZORPAY_CREDIT_PACKS) {
      try {
        const expireBy = Math.floor(Date.now() / 1000) + 180 * 24 * 60 * 60; // 6 months
        const payload = {
          amount: pack.amountSubunits,
          currency: pack.currency,
          description: `${pack.name} (1 credit = 100 person org chart)`,
          reference_id: `credit_pack_${pack.key}_${Date.now()}`,
          expire_by: expireBy,
          notes: { creditPackKey: pack.key },
          ...(callbackUrl ? { callback_url: callbackUrl, callback_method: 'get' as const } : {}),
        };
        const link = (await api.paymentLink.create(
          payload as unknown as Parameters<Razorpay['paymentLink']['create']>[0],
        )) as { id: string; short_url: string };
        result.push({ key: pack.key, shortUrl: link.short_url, id: link.id });
        this.logger.log(`Created payment link for ${pack.key}: ${link.short_url}`);
      } catch (err: unknown) {
        this.logger.error(`Failed to create payment link for ${pack.key}: ${err}`);
        throw err;
      }
    }

    return result;
  }
}
