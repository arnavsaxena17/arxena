/* @license Enterprise */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BillingSubscription } from 'src/engine/core-modules/billing/entities/billing-subscription.entity';
import { WorkspaceCredits } from 'src/engine/core-modules/billing/entities/workspace-credits.entity';
import { RazorpayCheckoutService } from 'src/engine/core-modules/billing/razorpay/services/razorpay-checkout.service';
import { RazorpayCustomerService } from 'src/engine/core-modules/billing/razorpay/services/razorpay-customer.service';
import { RazorpayOrderService } from 'src/engine/core-modules/billing/razorpay/services/razorpay-order.service';
import { RazorpayPlanService } from 'src/engine/core-modules/billing/razorpay/services/razorpay-plan.service';
import { RazorpayWebhookService } from 'src/engine/core-modules/billing/razorpay/services/razorpay-webhook.service';
import { MessageQueueModule } from 'src/engine/core-modules/message-queue/message-queue.module';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';

@Module({
  imports: [
    MessageQueueModule,
    TypeOrmModule.forFeature(
      [BillingSubscription, WorkspaceCredits, Workspace],
      'core',
    ),
  ],
  providers: [
    RazorpayOrderService,
    RazorpayCheckoutService,
    RazorpayPlanService,
    RazorpayCustomerService,
    RazorpayWebhookService,
  ],
  exports: [
    RazorpayOrderService,
    RazorpayCheckoutService,
    RazorpayPlanService,
    RazorpayCustomerService,
    RazorpayWebhookService,
  ],
})
export class RazorpayModule {}
