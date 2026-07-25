/* @license Enterprise */

import {
  Body,
  Controller,
  Headers,
  Logger,
  Post,
  Query,
  type RawBodyRequest,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';

import { type Response } from 'express';
import Stripe from 'stripe';

import { BillingWebhookCustomerService } from 'src/engine/core-modules/billing-webhook/services/billing-webhook-customer.service';
import { BillingWebhookEntitlementService } from 'src/engine/core-modules/billing-webhook/services/billing-webhook-entitlement.service';
import { BillingWebhookInvoiceService } from 'src/engine/core-modules/billing-webhook/services/billing-webhook-invoice.service';
import { BillingWebhookPriceService } from 'src/engine/core-modules/billing-webhook/services/billing-webhook-price.service';
import { BillingWebhookProductService } from 'src/engine/core-modules/billing-webhook/services/billing-webhook-product.service';
import { BillingWebhookSubscriptionScheduleService } from 'src/engine/core-modules/billing-webhook/services/billing-webhook-subscription-schedule.service';
import { BillingWebhookSubscriptionService } from 'src/engine/core-modules/billing-webhook/services/billing-webhook-subscription.service';
import {
  BillingException,
  BillingExceptionCode,
} from 'src/engine/core-modules/billing/billing.exception';
import { BillingWebhookEvent } from 'src/engine/core-modules/billing/enums/billing-webhook-events.enum';
import { BillingRestApiExceptionFilter } from 'src/engine/core-modules/billing/filters/billing-api-exception.filter';
import { BillingSubscriptionService } from 'src/engine/core-modules/billing/services/billing-subscription.service';
import { StripeWebhookService } from 'src/engine/core-modules/billing/stripe/services/stripe-webhook.service';
import { RazorpayWebhookService } from 'src/engine/core-modules/billing/razorpay/services/razorpay-webhook.service';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import * as crypto from 'crypto';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';

@Controller()
@UseFilters(BillingRestApiExceptionFilter)
export class BillingWebhookController {
  protected readonly logger = new Logger(BillingWebhookController.name);

  constructor(
    private readonly stripeWebhookService: StripeWebhookService,
    private readonly razorpayWebhookService: RazorpayWebhookService,
    private readonly environmentService: EnvironmentService,
    private readonly billingWebhookSubscriptionService: BillingWebhookSubscriptionService,
    private readonly billingWebhookEntitlementService: BillingWebhookEntitlementService,
    private readonly billingSubscriptionService: BillingSubscriptionService,
    private readonly billingWebhookProductService: BillingWebhookProductService,
    private readonly billingWebhookPriceService: BillingWebhookPriceService,
    private readonly billingWebhookInvoiceService: BillingWebhookInvoiceService,
    private readonly billingWebhookCustomerService: BillingWebhookCustomerService,
    private readonly billingWebhookSubscriptionScheduleService: BillingWebhookSubscriptionScheduleService,
  ) {}

  @Post(['webhooks/stripe'])
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async handleWebhooks(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ) {
    if (!req.rawBody) {
      throw new BillingException(
        'Missing request body',
        BillingExceptionCode.BILLING_MISSING_REQUEST_BODY,
      );
    }

    try {
      const event = this.stripeWebhookService.constructEventFromPayload(
        signature,
        req.rawBody,
      );
      const result = await this.handleStripeEvent(event);

      res.status(200).send(result).end();
    } catch (error) {
      if (
        error instanceof BillingException ||
        error instanceof Stripe.errors.StripeError
      ) {
        throw error;
      }
      const errorMessage =
        error instanceof Error ? error.message : JSON.stringify(error);

      throw new BillingException(
        errorMessage,
        BillingExceptionCode.BILLING_UNHANDLED_ERROR,
      );
    }
  }


  @Post(['webhooks/razorpay', 'billing/webhooks'])
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async handleRazorpayWebhooks(
    @Headers('x-razorpay-signature') razorpaySignature: string,
    @Headers('stripe-signature') stripeSignature: string,
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ) {
    if (!req.rawBody) {
      throw new BillingException(
        'Missing request body',
        BillingExceptionCode.BILLING_MISSING_REQUEST_BODY,
      );
    }

    if (razorpaySignature) {
      try {
        const result = await this.razorpayWebhookService.handlePayload(
          razorpaySignature,
          req.rawBody,
        );

        res.status(200).send(result).end();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : JSON.stringify(error);

        throw new BillingException(
          errorMessage,
          BillingExceptionCode.BILLING_UNHANDLED_ERROR,
        );
      }

      return;
    }

    // Compatibility: if this route receives Stripe by mistake, reject unless signature present
    if (stripeSignature) {
      return this.handleWebhooks(stripeSignature, req, res);
    }

    res.status(400).end();
  }

  @Post(['billing/razorpay-subscription-callback'])
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
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
    const baseRedirect = this.getRazorpayRedirectBase(returnUrl, returnPath);

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

    const keySecret = this.environmentService.get('BILLING_RAZORPAY_KEY_SECRET');

    if (!keySecret) {
      this.logger.warn('BILLING_RAZORPAY_KEY_SECRET not set');
      const params = new URLSearchParams({ subscription: 'failed' });

      res.redirect(302, `${baseRedirect}?${params.toString()}`);

      return;
    }

    const payload = subscriptionId
      ? `${paymentId}|${subscriptionId}`
      : orderId
        ? `${orderId}|${paymentId}`
        : paymentId;
    const expected = crypto
      .createHmac('sha256', keySecret)
      .update(payload)
      .digest('hex');

    if (expected !== signature) {
      this.logger.warn('Razorpay subscription callback signature mismatch');
      const params = new URLSearchParams({ subscription: 'failed' });

      res.redirect(302, `${baseRedirect}?${params.toString()}`);

      return;
    }

    const params = new URLSearchParams({ subscription: 'success' });

    res.redirect(302, `${baseRedirect}?${params.toString()}`);
  }

  private getRazorpayRedirectBase(
    returnUrl: string | undefined,
    returnPath: string | undefined,
  ): string {
    if (returnUrl && returnUrl.startsWith('http')) {
      try {
        return new URL(returnUrl).toString().replace(/\/$/, '');
      } catch {
        // fall through
      }
    }

    const frontendUrl = this.environmentService.get('FRONTEND_URL') ?? '';
    const path = returnPath?.startsWith('/') ? returnPath : `/${returnPath ?? 'settings/billing'}`;

    return `${frontendUrl.replace(/\/$/, '')}${path}`;
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

      case BillingWebhookEvent.SUBSCRIPTION_SCHEDULE_UPDATED:
        return await this.billingWebhookSubscriptionScheduleService.processStripeEvent(
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

      case BillingWebhookEvent.INVOICE_FINALIZED:
      case BillingWebhookEvent.INVOICE_PAID:
        return await this.billingWebhookInvoiceService.processStripeEvent(
          event,
        );

      case BillingWebhookEvent.CUSTOMER_CREATED:
      case BillingWebhookEvent.PAYMENT_METHOD_ATTACHED:
      case BillingWebhookEvent.PAYMENT_METHOD_DETACHED:
        return await this.billingWebhookCustomerService.processStripeEvent(
          event,
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
          event,
        );
      }

      default:
        return {};
    }
  }
}
