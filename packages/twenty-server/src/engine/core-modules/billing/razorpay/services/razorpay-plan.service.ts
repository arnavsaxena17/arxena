/* @license Enterprise */

import { Injectable, Logger } from '@nestjs/common';

import Razorpay from 'razorpay';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

const ENGAGEMENT_AMOUNT_YEARLY_SUBUNITS = 500000; // 5000 USD in cents

export type EngagementPlanInfo = {
  intervalKey: string;
  name: string;
  amountSubunits: number;
  currency: string;
  planId: string | null;
};

@Injectable()
export class RazorpayPlanService {
  protected readonly logger = new Logger(RazorpayPlanService.name);
  private readonly razorpay: Razorpay | null;

  constructor(private readonly environmentService: EnvironmentService) {
    const env = this.environmentService as { get(key: string): unknown };
    const keyId = env.get('BILLING_RAZORPAY_KEY_ID');
    const keySecret = env.get('BILLING_RAZORPAY_KEY_SECRET');
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
   * Create engagement plans: quarterly, 6-month (half_yearly), and annual.
   * Amount per user per licence: 5000/year; quarterly = 1250, half-year = 2500 (in subunits).
   */
  async createEngagementPlans(currency = 'USD'): Promise<{ id: string; period: string; interval: number }[]> {
    const api = this.getRazorpay();
    const created: { id: string; period: string; interval: number }[] = [];

    // Razorpay accepts period: daily | weekly | monthly | yearly only (quarterly is rejected in practice).
    // Quarterly = monthly interval 3; 6-month = monthly interval 6; Annual = yearly interval 1.
    const plans: { period: 'monthly' | 'yearly'; interval: number; amount: number; name: string }[] = [
      { period: 'monthly', interval: 3, amount: 125000, name: 'Engagement Quarterly (per user per licence)' },
      { period: 'monthly', interval: 6, amount: 250000, name: 'Engagement 6-Month (per user per licence)' },
      { period: 'yearly', interval: 1, amount: ENGAGEMENT_AMOUNT_YEARLY_SUBUNITS, name: 'Engagement Annual (per user per licence)' },
    ];

    for (const p of plans) {
      try {
        const plan = await api.plans.create({
          period: p.period,
          interval: p.interval,
          item: {
            name: p.name,
            amount: p.amount,
            currency,
            description: p.name,
          },
          notes: { type: 'engagement' },
        });
        created.push({ id: plan.id, period: p.period, interval: p.interval });
        this.logger.log(`Created Razorpay plan: ${plan.id} ${p.period} interval=${p.interval}`);
      } catch (err: unknown) {
        this.logger.error(`Failed to create plan ${p.name}: ${err}`);
        throw err;
      }
    }

    return created;
  }

  /**
   * Returns engagement plan options (quarterly, 6-month, annual) with planId from env when set.
   * Set BILLING_RAZORPAY_BASE_PLAN_ID for annual; BILLING_RAZORPAY_PLAN_QUARTERLY_ID and
   * BILLING_RAZORPAY_PLAN_6MONTH_ID for the other intervals (e.g. after running razorpay:setup-plans-and-links).
   */
  getEngagementPlans(currency = 'USD'): EngagementPlanInfo[] {
    const env = this.environmentService as { get(key: string): unknown };
    const basePlanId = env.get('BILLING_RAZORPAY_BASE_PLAN_ID') as string | undefined;
    const quarterlyId = env.get('BILLING_RAZORPAY_PLAN_QUARTERLY_ID') as string | undefined;
    const sixMonthId = env.get('BILLING_RAZORPAY_PLAN_6MONTH_ID') as string | undefined;

    return [
      {
        intervalKey: 'quarterly',
        name: 'Engagement Quarterly (per user per licence)',
        amountSubunits: 125000,
        currency,
        planId: quarterlyId ?? basePlanId ?? null,
      },
      {
        intervalKey: '6month',
        name: 'Engagement 6-Month (per user per licence)',
        amountSubunits: 250000,
        currency,
        planId: sixMonthId ?? basePlanId ?? null,
      },
      {
        intervalKey: 'annual',
        name: 'Engagement Annual (per user per licence)',
        amountSubunits: ENGAGEMENT_AMOUNT_YEARLY_SUBUNITS,
        currency,
        planId: basePlanId ?? null,
      },
    ];
  }

  getPlanIdForInterval(interval: 'quarterly' | '6month' | 'annual'): string | null {
    const plans = this.getEngagementPlans();
    const plan = plans.find((p) => p.intervalKey === interval);
    return plan?.planId ?? null;
  }
}
