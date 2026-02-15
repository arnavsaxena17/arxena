/* @license Enterprise */

import { Logger, Scope } from '@nestjs/common';

import Stripe from 'stripe';

import { BillingWebhookSubscriptionService } from 'src/engine/core-modules/billing/webhooks/services/billing-webhook-subscription.service';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';

export type ProcessStripeSubscriptionEventJobData = {
  workspaceId: string;
  eventData:
    | Stripe.CustomerSubscriptionUpdatedEvent.Data
    | Stripe.CustomerSubscriptionCreatedEvent.Data
    | Stripe.CustomerSubscriptionDeletedEvent.Data;
};

@Processor({
  queueName: MessageQueue.billingQueue,
  scope: Scope.REQUEST,
})
export class ProcessStripeSubscriptionEventJob {
  protected readonly logger = new Logger(
    ProcessStripeSubscriptionEventJob.name,
  );

  constructor(
    private readonly billingWebhookSubscriptionService: BillingWebhookSubscriptionService,
  ) {}

  @Process(ProcessStripeSubscriptionEventJob.name)
  async handle(data: ProcessStripeSubscriptionEventJobData): Promise<void> {
    this.logger.log(
      `Processing Stripe subscription event for workspace ${data.workspaceId}`,
    );
    await this.billingWebhookSubscriptionService.processStripeEvent(
      data.workspaceId,
      data.eventData,
    );
  }
}
