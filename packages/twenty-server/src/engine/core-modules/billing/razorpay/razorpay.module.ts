/* @license Enterprise */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BillingSubscriptionEntity } from 'src/engine/core-modules/billing/entities/billing-subscription.entity';
import { CreditTransaction } from 'src/engine/core-modules/billing/entities/credit-transaction.entity';
import { WorkspaceCredits } from 'src/engine/core-modules/billing/entities/workspace-credits.entity';
import { RazorpayCheckoutService } from 'src/engine/core-modules/billing/razorpay/services/razorpay-checkout.service';
import { RazorpayCustomerService } from 'src/engine/core-modules/billing/razorpay/services/razorpay-customer.service';
import { RazorpayOrderService } from 'src/engine/core-modules/billing/razorpay/services/razorpay-order.service';
import { RazorpayPlanService } from 'src/engine/core-modules/billing/razorpay/services/razorpay-plan.service';
import { RazorpayWebhookService } from 'src/engine/core-modules/billing/razorpay/services/razorpay-webhook.service';
import { CreditTransactionService } from 'src/engine/core-modules/billing/services/credit-transaction.service';
import { EnvironmentModule } from 'src/engine/core-modules/environment/environment.module';
import { MessageQueueModule } from 'src/engine/core-modules/message-queue/message-queue.module';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

@Module({
  imports: [
    EnvironmentModule,
    MessageQueueModule,
    TypeOrmModule.forFeature([
      BillingSubscriptionEntity,
      WorkspaceCredits,
      WorkspaceEntity,
      CreditTransaction,
    ]),
  ],
  providers: [
    CreditTransactionService,
    RazorpayOrderService,
    RazorpayCheckoutService,
    RazorpayPlanService,
    RazorpayCustomerService,
    RazorpayWebhookService,
  ],
  exports: [
    CreditTransactionService,
    RazorpayOrderService,
    RazorpayCheckoutService,
    RazorpayPlanService,
    RazorpayCustomerService,
    RazorpayWebhookService,
  ],
})
export class RazorpayModule {}
