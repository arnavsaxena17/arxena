/* @license Enterprise */

import { Injectable, Logger } from '@nestjs/common';

import {
  getCreditPackTierPrice,
  SupportedPricingCurrency,
} from 'twenty-shared';

import {
  CreditPackKey,
  RAZORPAY_CREDIT_PACKS,
} from 'src/engine/core-modules/billing/razorpay/constants/credit-packs.constant';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

type OrderNotes = {
  workspaceId?: string;
  creditPackKey?: string;
  selectedCurrency?: string;
  requestedCurrency?: string;
};

const CREDIT_CARD_SURCHARGE_RATE = 0.03;

const normalizePricingAmountSubunits = (amountSubunits: number): number => {
  const amountMajor = Math.max(1, Math.round(amountSubunits / 100));

  if (amountMajor >= 1000) {
    const rounded = Math.round(amountMajor / 1000) * 1000 - 1;

    return Math.max(999, rounded) * 100;
  }

  if (amountMajor >= 100) {
    const rounded = Math.round(amountMajor / 100) * 100 - 1;

    return Math.max(99, rounded) * 100;
  }

  return amountMajor * 100;
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
    selectedCurrency?: SupportedPricingCurrency,
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
    const sourceCurrency = this.toSupportedCurrency(pack.currency) ?? 'GBP';
    const requestedCurrency = this.toSupportedCurrency(selectedCurrency);
    const chargeCurrency = requestedCurrency ?? sourceCurrency;

    // Prefer the explicit per-currency price from the tier table when present
    // (the new 4-plan/volume-tier model has hand-tuned numbers per currency,
    // not derived from GBP via FX). Falls back to GBP-rate conversion otherwise.
    const convertedAmountSubunits = getCreditPackTierPrice(
      pack,
      chargeCurrency,
    );
    const mapsCount = Math.max(1, pack.mapsCount ?? 1);
    const totalAmountSubunits = convertedAmountSubunits * mapsCount;

    const amountWithSurcharge = this.computeAmountWithSurcharge(totalAmountSubunits);
    const createOrder = async (
      currency: SupportedPricingCurrency,
      amount: number,
    ) => {
      const res = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          currency,
          notes: {
            workspaceId,
            creditPackKey: pack.key,
            selectedCurrency: currency,
            requestedCurrency: chargeCurrency,
          },
        }),
      });

      return res;
    };
    let res = await createOrder(chargeCurrency, amountWithSurcharge);

    if (!res.ok && res.status === 400 && chargeCurrency !== 'INR') {
      const inrAmountWithSurcharge = this.computeAmountWithSurcharge(
        getCreditPackTierPrice(pack, 'INR') * mapsCount,
      );

      this.logger.warn(
        `Razorpay order creation failed for ${chargeCurrency}; retrying in INR`,
      );
      res = await createOrder('INR', inrAmountWithSurcharge);
    }

    if (!res.ok) {
      const errText = await res.text();

      this.logger.error(
        `Razorpay create order failed: ${res.status} ${errText}`,
      );
      throw new Error(`Razorpay create order failed: ${res.status}`);
    }
    const data = (await res.json()) as {
      id: string;
      amount: number;
      currency: string;
    };

    return {
      orderId: data.id,
      amount: data.amount,
      currency: data.currency,
      keyId,
    };
  }

  private computeAmountWithSurcharge(totalAmountSubunits: number): number {
    const surchargeAmountSubunits = Math.round(
      totalAmountSubunits * CREDIT_CARD_SURCHARGE_RATE,
    );

    return normalizePricingAmountSubunits(
      totalAmountSubunits + surchargeAmountSubunits,
    );
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
        method: 'GET',
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

  private toSupportedCurrency(
    currency: string | undefined,
  ): SupportedPricingCurrency | null {
    if ( currency === 'INR' || currency === 'USD' || currency === 'GBP' || currency === 'EUR' || currency === 'AUD' || currency === 'AED' ) {
      return currency;
    }
    return null;
  }
}
