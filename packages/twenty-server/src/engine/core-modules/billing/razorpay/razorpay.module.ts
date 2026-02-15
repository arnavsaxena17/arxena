/* @license Enterprise */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BillingCustomer } from 'src/engine/core-modules/billing/entities/billing-customer.entity';
import { BillingSubscription } from 'src/engine/core-modules/billing/entities/billing-subscription.entity';
import { WorkspaceCredits } from 'src/engine/core-modules/billing/entities/workspace-credits.entity';
import { RazorpayCustomerService } from 'src/engine/core-modules/billing/razorpay/services/razorpay-customer.service';
import { RazorpayOrderService } from 'src/engine/core-modules/billing/razorpay/services/razorpay-order.service';
import { RazorpayPaymentLinkService } from 'src/engine/core-modules/billing/razorpay/services/razorpay-payment-link.service';
import { RazorpayPlanService } from 'src/engine/core-modules/billing/razorpay/services/razorpay-plan.service';
import { RazorpaySubscriptionService } from 'src/engine/core-modules/billing/razorpay/services/razorpay-subscription.service';
import { RazorpayWebhookService } from 'src/engine/core-modules/billing/razorpay/services/razorpay-webhook.service';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [BillingCustomer, BillingSubscription, WorkspaceCredits],
      'core',
    ),
  ],
  providers: [
    RazorpayWebhookService,
    RazorpayPlanService,
    RazorpayPaymentLinkService,
    RazorpayCustomerService,
    RazorpayOrderService,
    RazorpaySubscriptionService,
  ],
  exports: [
    RazorpayWebhookService,
    RazorpayPlanService,
    RazorpayPaymentLinkService,
    RazorpayCustomerService,
    RazorpayOrderService,
    RazorpaySubscriptionService,
  ],
})
export class RazorpayModule {}
