/* @license Enterprise */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import * as crypto from 'crypto';
import { In, Repository } from 'typeorm';

import type { FindOptionsWhere } from 'typeorm';

import { BillingSubscription } from 'src/engine/core-modules/billing/entities/billing-subscription.entity';
import { WorkspaceCredits } from 'src/engine/core-modules/billing/entities/workspace-credits.entity';
import { SubscriptionStatus } from 'src/engine/core-modules/billing/enums/billing-subscription-status.enum';
import {
    RAZORPAY_CREDIT_PACKS,
    type CreditPackKey,
} from 'src/engine/core-modules/billing/razorpay/constants/credit-packs.constant';
import { RazorpayOrderService } from 'src/engine/core-modules/billing/razorpay/services/razorpay-order.service';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

type RazorpayWebhookPayload = {
  event: string;
  payload: {
    payment?: {
      entity: {
        id: string;
        order_id?: string;
        notes?: Record<string, string>;
      };
    };
    subscription?: {
      entity: {
        id: string;
        status?: string;
        notes?: Record<string, string>;
        current_start?: number;
        current_end?: number;
        charge_at?: number;
        end_at?: number;
      };
    };
  };
};

const RAZORPAY_STATUS_TO_SUBSCRIPTION_STATUS: Record<
  string,
  SubscriptionStatus
> = {
  active: SubscriptionStatus.Active,
  authenticated: SubscriptionStatus.Trialing,
  created: SubscriptionStatus.Incomplete,
  pending: SubscriptionStatus.Incomplete,
  cancelled: SubscriptionStatus.Canceled,
  completed: SubscriptionStatus.Canceled,
  expired: SubscriptionStatus.IncompleteExpired,
  halted: SubscriptionStatus.Paused,
};

@Injectable()
export class RazorpayWebhookService {
  protected readonly logger = new Logger(RazorpayWebhookService.name);

  constructor(
    private readonly environmentService: EnvironmentService,
    private readonly razorpayOrderService: RazorpayOrderService,
    @InjectRepository(WorkspaceCredits, 'core')
    private readonly workspaceCreditsRepository: Repository<WorkspaceCredits>,
    @InjectRepository(BillingSubscription, 'core')
    private readonly billingSubscriptionRepository: Repository<BillingSubscription>,
  ) {}

  handlePayload(signature: string, rawBody: Buffer | Uint8Array): Promise<Record<string, unknown>> {
    const secretVal = (
      this.environmentService as { get(key: string): unknown }
    ).get('BILLING_RAZORPAY_WEBHOOK_SECRET');
    const secret = typeof secretVal === 'string' ? secretVal : '';
    if (!secret) {
      throw new Error('BILLING_RAZORPAY_WEBHOOK_SECRET is not set');
    }

    const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(bodyBuffer as crypto.BinaryLike)
      .digest('hex');

    if (expectedSignature !== signature) {
      this.logger.warn('Razorpay webhook signature mismatch');
      throw new Error('Invalid Razorpay webhook signature');
    }

    let body: RazorpayWebhookPayload;
    try {
      body = JSON.parse(bodyBuffer.toString('utf8')) as RazorpayWebhookPayload;
    } catch {
      throw new Error('Invalid Razorpay webhook body');
    }

    const event = body.event;
    this.logger.log(`Razorpay webhook event: ${event}`);

    switch (event) {
      case 'payment.captured':
        return this.handlePaymentCaptured(body);
      case 'subscription.activated':
      case 'subscription.charged':
      case 'subscription.cancelled':
      case 'subscription.completed':
        return this.handleSubscriptionEvent(body);
      default:
        return Promise.resolve({ received: true, event });
    }
  }

  private async handlePaymentCaptured(
    body: RazorpayWebhookPayload,
  ): Promise<Record<string, unknown>> {
    const payment = body.payload?.payment?.entity;
    if (!payment?.id) {
      return { received: true, event: 'payment.captured' };
    }

    let workspaceId: string | undefined = payment.notes?.workspaceId;
    let creditPackKey: string | undefined = payment.notes?.creditPackKey;
    if ((!workspaceId || !creditPackKey) && payment.order_id) {
      const orderNotes = await this.razorpayOrderService.getOrderNotes(
        payment.order_id,
      );
      workspaceId = workspaceId ?? orderNotes?.workspaceId;
      creditPackKey = creditPackKey ?? orderNotes?.creditPackKey;
    }
    if (!workspaceId || !creditPackKey) {
      this.logger.log(
        'payment.captured missing workspaceId or creditPackKey (payment.notes and order notes), skipping credits',
      );
      return { received: true, event: 'payment.captured' };
    }

    const creditPackKeyTyped = creditPackKey as CreditPackKey;
    const pack = RAZORPAY_CREDIT_PACKS.find((p) => p.key === creditPackKeyTyped);
    if (!pack) {
      this.logger.warn(`Unknown creditPackKey: ${creditPackKeyTyped}`);
      return { received: true, event: 'payment.captured' };
    }

    const row = await this.workspaceCreditsRepository.findOne({
      where: { workspaceId },
    });
    if (row) {
      await this.workspaceCreditsRepository.update(
        { workspaceId },
        { credits: row.credits + pack.credits },
      );
    } else {
      await this.workspaceCreditsRepository.insert({
        workspaceId,
        credits: pack.credits,
      });
    }

    this.logger.log(
      `payment.captured: added ${pack.credits} credits for workspace ${workspaceId}`,
    );
    return { received: true, event: 'payment.captured' };
  }

  private async handleSubscriptionEvent(
    body: RazorpayWebhookPayload,
  ): Promise<Record<string, unknown>> {
    const sub = body.payload?.subscription?.entity;
    if (!sub?.id) {
      return { received: true, event: body.event };
    }

    const workspaceId = sub.notes?.workspaceId;
    if (!workspaceId) {
      this.logger.log(
        `Razorpay subscription event ${body.event} missing notes.workspaceId`,
      );
      return { received: true, event: body.event };
    }

    const status =
      RAZORPAY_STATUS_TO_SUBSCRIPTION_STATUS[sub.status ?? ''] ??
      SubscriptionStatus.Incomplete;

    const currentPeriodStart = sub.current_start
      ? new Date(sub.current_start * 1000)
      : new Date();
    const currentEnd = sub.current_end ?? sub.charge_at ?? sub.end_at;
    const currentPeriodEnd = currentEnd
      ? new Date(currentEnd * 1000)
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    let existing = await this.billingSubscriptionRepository.findOne({
      where: { razorpaySubscriptionId: sub.id },
    });
    if (!existing) {
      existing = await this.billingSubscriptionRepository.findOne({
        where: { workspaceId },
      });
    }

    const subscriptionData = {
      razorpaySubscriptionId: sub.id,
      status,
      currentPeriodStart,
      currentPeriodEnd,
    };

    const activeStatuses = [
      SubscriptionStatus.Active,
      SubscriptionStatus.Trialing,
      SubscriptionStatus.PastDue,
    ];
    const isNewStatusActive = activeStatuses.includes(status);

    await this.billingSubscriptionRepository.manager.transaction(
      async (tx) => {
        const repo = tx.getRepository(BillingSubscription);
        if (isNewStatusActive) {
          await repo.update(
            {
              workspaceId,
              status: In(activeStatuses),
            } as FindOptionsWhere<BillingSubscription>,
            { status: SubscriptionStatus.Canceled },
          );
        }
        if (existing) {
          await repo.update({ id: existing.id }, subscriptionData);
        } else {
          await repo.insert({
            workspaceId,
            ...subscriptionData,
            stripeCustomerId: null,
            stripeSubscriptionId: null,
          });
        }
      },
    );

    this.logger.log(
      `Razorpay subscription ${body.event}: id=${sub.id} workspaceId=${workspaceId} status=${status}`,
    );
    return { received: true, event: body.event };
  }
}
