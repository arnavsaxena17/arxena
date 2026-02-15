/* @license Enterprise */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import Stripe from 'stripe';
import { WorkspaceActivationStatus } from 'twenty-shared';
import { In, Repository } from 'typeorm';

import { BillingCustomer } from 'src/engine/core-modules/billing/entities/billing-customer.entity';
import { BillingSubscriptionItem } from 'src/engine/core-modules/billing/entities/billing-subscription-item.entity';
import { BillingSubscription } from 'src/engine/core-modules/billing/entities/billing-subscription.entity';
import { SubscriptionStatus } from 'src/engine/core-modules/billing/enums/billing-subscription-status.enum';
import { StripeCustomerService } from 'src/engine/core-modules/billing/stripe/services/stripe-customer.service';
import { transformStripeSubscriptionEventToDatabaseCustomer } from 'src/engine/core-modules/billing/webhooks/utils/transform-stripe-subscription-event-to-database-customer.util';
import { transformStripeSubscriptionEventToDatabaseSubscriptionItem } from 'src/engine/core-modules/billing/webhooks/utils/transform-stripe-subscription-event-to-database-subscription-item.util';
import { transformStripeSubscriptionEventToDatabaseSubscription } from 'src/engine/core-modules/billing/webhooks/utils/transform-stripe-subscription-event-to-database-subscription.util';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { Workspace } from 'src/engine/core-modules/workspace/workspace.entity';
import {
    CleanWorkspaceDeletionWarningUserVarsJob,
    CleanWorkspaceDeletionWarningUserVarsJobData,
} from 'src/engine/workspace-manager/workspace-cleaner/jobs/clean-workspace-deletion-warning-user-vars.job';

const BILLING_SUBSCRIPTION_STATUS_BY_WORKSPACE_ACTIVATION_STATUS = {
  [WorkspaceActivationStatus.ACTIVE]: [
    SubscriptionStatus.Active,
    SubscriptionStatus.Trialing,
    SubscriptionStatus.PastDue,
  ],
  [WorkspaceActivationStatus.SUSPENDED]: [
    SubscriptionStatus.Canceled,
    SubscriptionStatus.Unpaid,
    SubscriptionStatus.Paused,
  ],
};

@Injectable()
export class BillingWebhookSubscriptionService {
  protected readonly logger = new Logger(
    BillingWebhookSubscriptionService.name,
  );
  constructor(
    private readonly stripeCustomerService: StripeCustomerService,
    @InjectMessageQueue(MessageQueue.workspaceQueue)
    private readonly messageQueueService: MessageQueueService,
    @InjectRepository(BillingSubscription, 'core')
    private readonly billingSubscriptionRepository: Repository<BillingSubscription>,
    @InjectRepository(BillingSubscriptionItem, 'core')
    private readonly billingSubscriptionItemRepository: Repository<BillingSubscriptionItem>,
    @InjectRepository(Workspace, 'core')
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(BillingCustomer, 'core')
    private readonly billingCustomerRepository: Repository<BillingCustomer>,
  ) {}

  async processStripeEvent(
    workspaceId: string,
    data:
      | Stripe.CustomerSubscriptionUpdatedEvent.Data
      | Stripe.CustomerSubscriptionCreatedEvent.Data
      | Stripe.CustomerSubscriptionDeletedEvent.Data,
  ) {

    this.logger.log(`Processing stripe event for workspace ${workspaceId}`);
    this.logger.log(`Stripe event data: ${JSON.stringify(data)}`);

    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return { noWorkspace: true };
    }

    await this.billingCustomerRepository.upsert(
      transformStripeSubscriptionEventToDatabaseCustomer(workspaceId, data),
      {
        conflictPaths: ['workspaceId'],
        skipUpdateIfNoValuesChanged: true,
      },
    );

    const incomingStatus = data.object.status as Stripe.Subscription['status'];
    const isIncomingActive =
      incomingStatus === 'trialing' ||
      incomingStatus === 'active' ||
      incomingStatus === 'past_due';

    if (isIncomingActive) {
      const otherActiveSubscriptions = await this.billingSubscriptionRepository.find(
        {
          where: {
            workspaceId,
            status: In([
              SubscriptionStatus.Trialing,
              SubscriptionStatus.Active,
              SubscriptionStatus.PastDue,
            ]),
          },
          select: ['stripeSubscriptionId'],
        },
      );
      const otherIds = otherActiveSubscriptions
        .filter((s) => s.stripeSubscriptionId !== data.object.id)
        .map((s) => s.stripeSubscriptionId);

      if (otherIds.length > 0) {
        await this.billingSubscriptionRepository.update(
          {
            workspaceId,
            stripeSubscriptionId: In(otherIds),
          },
          {
            status: SubscriptionStatus.Canceled,
            endedAt: new Date(),
            canceledAt: new Date(),
          },
        );
      }
    }

    await this.billingSubscriptionRepository.upsert(
      transformStripeSubscriptionEventToDatabaseSubscription(workspaceId, data),
      {
        conflictPaths: ['stripeSubscriptionId'],
        skipUpdateIfNoValuesChanged: true,
      },
    );

    const billingSubscriptions = await this.billingSubscriptionRepository.find({
      where: { workspaceId },
    });

    const updatedBillingSubscription = billingSubscriptions.find(
      (subscription) => subscription.stripeSubscriptionId === data.object.id,
    );

    if (!updatedBillingSubscription) {
      throw new Error('Billing subscription not found');
    }

    const hasActiveWorkspaceCompatibleSubscription = billingSubscriptions.some(
      (subscription) =>
        BILLING_SUBSCRIPTION_STATUS_BY_WORKSPACE_ACTIVATION_STATUS[
          WorkspaceActivationStatus.ACTIVE
        ].includes(subscription.status),
    );

    await this.billingSubscriptionItemRepository.upsert(
      transformStripeSubscriptionEventToDatabaseSubscriptionItem(
        updatedBillingSubscription.id,
        data,
      ),
      {
        conflictPaths: ['billingSubscriptionId', 'stripeProductId'],
        skipUpdateIfNoValuesChanged: true,
      },
    );

    if (
      BILLING_SUBSCRIPTION_STATUS_BY_WORKSPACE_ACTIVATION_STATUS[
        WorkspaceActivationStatus.SUSPENDED
      ].includes(data.object.status as SubscriptionStatus) &&
      !hasActiveWorkspaceCompatibleSubscription
    ) {
      console.log("Marking as suspended for workspace updated at ${workspace.updatedAt} with subscription status ${subscription.status} and subscription updatedAt ${subscription.updatedAt} and canceledAt ${subscription.canceledAt}");
      await this.workspaceRepository.update(workspaceId, {
        activationStatus: WorkspaceActivationStatus.SUSPENDED,
      });
    }

    if (
      BILLING_SUBSCRIPTION_STATUS_BY_WORKSPACE_ACTIVATION_STATUS[
        WorkspaceActivationStatus.ACTIVE
      ].includes(data.object.status as SubscriptionStatus) &&
      workspace.activationStatus == WorkspaceActivationStatus.SUSPENDED
    ) {
      await this.workspaceRepository.update(workspaceId, {
        activationStatus: WorkspaceActivationStatus.ACTIVE,
      });

      await this.messageQueueService.add<CleanWorkspaceDeletionWarningUserVarsJobData>(
        CleanWorkspaceDeletionWarningUserVarsJob.name,
        { workspaceId },
      );
    }

    await this.stripeCustomerService.updateCustomerMetadataWorkspaceId(
      String(data.object.customer),
      workspaceId,
    );

    return {
      stripeSubscriptionId: data.object.id,
      stripeCustomerId: data.object.customer,
    };
  }
}
