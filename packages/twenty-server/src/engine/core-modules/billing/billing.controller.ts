/* @license Enterprise */

import {
  Body,
  Controller,
  Headers,
  Logger,
  Post,
  Query,
  RawBodyRequest,
  Req,
  Res,
  UseFilters,
} from '@nestjs/common';

import { createHmac } from 'crypto';
import { Response } from 'express';
import Stripe from 'stripe';

import {
  BillingException,
  BillingExceptionCode,
} from 'src/engine/core-modules/billing/billing.exception';
import { BillingWebhookEvent } from 'src/engine/core-modules/billing/enums/billing-webhook-events.enum';
import { BillingRestApiExceptionFilter } from 'src/engine/core-modules/billing/filters/billing-api-exception.filter';
import { RazorpayWebhookService } from 'src/engine/core-modules/billing/razorpay/services/razorpay-webhook.service';
import { BillingSubscriptionService } from 'src/engine/core-modules/billing/services/billing-subscription.service';
import { StripeWebhookService } from 'src/engine/core-modules/billing/stripe/services/stripe-webhook.service';
import { BillingWebhookEntitlementService } from 'src/engine/core-modules/billing/webhooks/services/billing-webhook-entitlement.service';
import { BillingWebhookPriceService } from 'src/engine/core-modules/billing/webhooks/services/billing-webhook-price.service';
import { BillingWebhookProductService } from 'src/engine/core-modules/billing/webhooks/services/billing-webhook-product.service';
import { BillingWebhookSubscriptionService } from 'src/engine/core-modules/billing/webhooks/services/billing-webhook-subscription.service';
import { DomainManagerService } from 'src/engine/core-modules/domain-manager/services/domain-manager.service';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

@Controller('billing')
@UseFilters(BillingRestApiExceptionFilter)
export class BillingController {
  protected readonly logger = new Logger(BillingController.name);

  constructor(
    private readonly stripeWebhookService: StripeWebhookService,
    private readonly razorpayWebhookService: RazorpayWebhookService,
    private readonly billingWebhookSubscriptionService: BillingWebhookSubscriptionService,
    private readonly billingWebhookEntitlementService: BillingWebhookEntitlementService,
    private readonly billingSubscriptionService: BillingSubscriptionService,
    private readonly billingWebhookProductService: BillingWebhookProductService,
    private readonly billingWebhookPriceService: BillingWebhookPriceService,
    private readonly domainManagerService: DomainManagerService,
    private readonly environmentService: EnvironmentService,
  ) {}

  @Post('/webhooks')
  async handleWebhooks(
    @Headers('stripe-signature') stripeSignature: string,
    @Headers('x-razorpay-signature') razorpaySignature: string,
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ) {
    if (!req.rawBody) {
      res.status(400).end();
      return;
    }

    if (razorpaySignature) {
      try {
        const result = await this.razorpayWebhookService.handlePayload(
          razorpaySignature,
          req.rawBody,
        );
        res.status(200).send(result).end();
      } catch {
        res.status(400).end();
      }
      return;
    }

    if (stripeSignature) {
      const event = this.stripeWebhookService.constructEventFromPayload(
        stripeSignature,
        req.rawBody,
      );
      try {
        const result = await this.handleStripeEvent(event);
        res.status(200).send(result).end();
      } catch (error) {
        if (error instanceof BillingException) {
          res.status(404).end();
        }
      }
      return;
    }

    res.status(400).end();
  }

  @Post('razorpay-subscription-callback')
  async razorpaySubscriptionCallback(
    @Query('return_path') returnPath: string,
    @Query('return_url') returnUrl: string,
    @Body()
    body: {
      razorpay_payment_id?: string;
      razorpay_subscription_id?: string;
      razorpay_order_id?: string;
      razorpay_signature?: string;
      error?: { code?: string; description?: string };
    },
    @Res() res: Response,
  ) {
    const baseRedirect = this.getRedirectBase(returnUrl, returnPath);

    if (body.error) {
      const params = new URLSearchParams({ subscription: 'failed' });
      res.redirect(302, `${baseRedirect}?${params.toString()}`);
      return;
    }

    const paymentId = body.razorpay_payment_id;
    const subscriptionId = body.razorpay_subscription_id;
    const orderId = body.razorpay_order_id;
    const signature = body.razorpay_signature;
    if (!paymentId || !signature) {
      const params = new URLSearchParams({ subscription: 'failed' });
      res.redirect(302, `${baseRedirect}?${params.toString()}`);
      return;
    }

    const keySecret = this.environmentService.get(
      'BILLING_RAZORPAY_KEY_SECRET',
    );
    if (!keySecret) {
      this.logger.warn('BILLING_RAZORPAY_KEY_SECRET not set');
      const params = new URLSearchParams({ subscription: 'failed' });
      res.redirect(302, `${baseRedirect}?${params.toString()}`);
      return;
    }

    const valid =
      this.verifyRazorpayCallbackSignature(
        keySecret,
        signature,
        paymentId,
        subscriptionId,
        orderId,
      );
    if (!valid) {
      this.logger.warn('Razorpay subscription callback signature mismatch');
      const params = new URLSearchParams({ subscription: 'failed' });
      res.redirect(302, `${baseRedirect}?${params.toString()}`);
      return;
    }

    const params = new URLSearchParams({ subscription: 'success' });
    res.redirect(302, `${baseRedirect}?${params.toString()}`);
  }

  private getRedirectBase(returnUrl: string | undefined, returnPath: string | undefined): string {
    if (returnUrl && returnUrl.startsWith('http')) {
      try {
        const url = new URL(returnUrl);
        return url.origin + url.pathname;
      } catch {
        // fall through to path-based redirect
      }
    }
    const frontUrl = this.domainManagerService.getFrontUrl();
    const path =
      returnPath && returnPath.startsWith('/') ? returnPath : `/${returnPath || ''}`;
    return `${frontUrl.origin}${path}`;
  }

  private verifyRazorpayCallbackSignature(
    keySecret: string,
    signature: string,
    paymentId: string,
    subscriptionId: string | undefined,
    orderId: string | undefined,
  ): boolean {
    const candidates = [
      subscriptionId && `${subscriptionId}|${paymentId}`,
      subscriptionId && `${paymentId}|${subscriptionId}`,
      orderId && `${orderId}|${paymentId}`,
      orderId && `${paymentId}|${orderId}`,
    ].filter(Boolean) as string[];
    for (const payload of candidates) {
      const expected = createHmac('sha256', keySecret).update(payload).digest('hex');
      if (expected === signature) return true;
    }
    return false;
  }

  private async handleStripeEvent(event: Stripe.Event) {
    switch (event.type) {
      case BillingWebhookEvent.SETUP_INTENT_SUCCEEDED:
        return await this.billingSubscriptionService.handleUnpaidInvoices(
          event.data,
        );
      case BillingWebhookEvent.PRICE_UPDATED:
      case BillingWebhookEvent.PRICE_CREATED:
        return await this.billingWebhookPriceService.processStripeEvent(
          event.data,
        );

      case BillingWebhookEvent.PRODUCT_UPDATED:
      case BillingWebhookEvent.PRODUCT_CREATED:
        return await this.billingWebhookProductService.processStripeEvent(
          event.data,
        );
      case BillingWebhookEvent.CUSTOMER_ACTIVE_ENTITLEMENT_SUMMARY_UPDATED:
        return await this.billingWebhookEntitlementService.processStripeEvent(
          event.data,
        );

      case BillingWebhookEvent.CUSTOMER_SUBSCRIPTION_CREATED:
      case BillingWebhookEvent.CUSTOMER_SUBSCRIPTION_UPDATED:
      case BillingWebhookEvent.CUSTOMER_SUBSCRIPTION_DELETED: {
        const workspaceId = event.data.object.metadata?.workspaceId;

        if (!workspaceId) {
          throw new BillingException(
            'Workspace ID is required for subscription events',
            BillingExceptionCode.BILLING_SUBSCRIPTION_EVENT_WORKSPACE_NOT_FOUND,
          );
        }

        return await this.billingWebhookSubscriptionService.processStripeEvent(
          workspaceId,
          event.data,
        );
      }
      default:
        return {};
    }
  }
}
