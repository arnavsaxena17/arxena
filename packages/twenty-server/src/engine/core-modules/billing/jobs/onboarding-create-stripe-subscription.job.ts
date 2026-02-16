/* @license Enterprise */

import { Logger, Scope } from '@nestjs/common';

import { OnboardingBillingSubscriptionService } from 'src/engine/core-modules/billing/services/onboarding-billing-subscription.service';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';

export type OnboardingCreateStripeSubscriptionJobData = {
  workspaceId: string;
  userEmail: string;
};

@Processor({
  queueName: MessageQueue.billingQueue,
  scope: Scope.REQUEST,
})
export class OnboardingCreateStripeSubscriptionJob {
  protected readonly logger = new Logger(
    OnboardingCreateStripeSubscriptionJob.name,
  );

  constructor(
    private readonly onboardingBillingSubscriptionService: OnboardingBillingSubscriptionService,
  ) {}

  @Process(OnboardingCreateStripeSubscriptionJob.name)
  async handle(
    data: OnboardingCreateStripeSubscriptionJobData,
  ): Promise<void> {
    this.logger.log(
      `Creating Stripe subscription for onboarding workspace ${data.workspaceId}`,
    );
    await this.onboardingBillingSubscriptionService.createCustomerAndSubscriptionForOnboarding(
      {
        workspaceId: data.workspaceId,
        userEmail: data.userEmail,
      },
    );
  }
}
