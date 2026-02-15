/* @license Enterprise */

import {
  Controller,
  Headers,
  Logger,
  Post,
  RawBodyRequest,
  Req,
  Res,
  UseFilters,
} from '@nestjs/common';

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
  ) {}

  @Post('/webhooks')
  async handleWebhooks(
    @Headers('stripe-signature') stripeSignature: string,
    @Headers('x-razorpay-signature') razorpaySignature: string,
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ) {
    const rawBody = req.rawBody;
    if (!req.rawBody) {
      res.status(400).end();

      return;
    }

    const isStripe = Boolean(stripeSignature);
    const isRazorpay = Boolean(razorpaySignature);

    if (isStripe && isRazorpay) {
      res.status(400).send('Ambiguous webhook: both stripe-signature and x-razorpay-signature present').end();
      return;
    }

    if (isRazorpay) {
      try {
        const result = await this.razorpayWebhookService.handlePayload(
          razorpaySignature,
          req.rawBody,
        );
        res.status(200).send(result ?? {}).end();
      } catch (error) {
        if (error instanceof BillingException) {
          res.status(404).end();
        } else {
          this.logger.warn('Razorpay webhook error', error);
          res.status(400).end();
        }
      }
      return;
    }

    if (!isStripe) {
      res.status(400).send('Missing stripe-signature or x-razorpay-signature header').end();
      return;
    }

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
