import { Injectable, Logger } from '@nestjs/common';

import { ArrayContains } from 'typeorm';

import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { TwentyORMGlobalManager } from 'src/engine/twenty-orm/twenty-orm-global.manager';
import {
  CallWebhookJob,
  CallWebhookJobData,
} from 'src/modules/webhook/jobs/call-webhook.job';
import { WebhookWorkspaceEntity } from 'src/modules/webhook/standard-objects/webhook.workspace-entity';

export type OrgChartEmbedWebhookEventName = 'embed.viewed' | 'embed.node_clicked';

@Injectable()
export class OrgChartEmbedWebhookService {
  private readonly logger = new Logger(OrgChartEmbedWebhookService.name);

  constructor(
    @InjectMessageQueue(MessageQueue.webhookQueue)
    private readonly messageQueueService: MessageQueueService,
    private readonly twentyORMGlobalManager: TwentyORMGlobalManager,
  ) {}

  async emitEmbedEvent(input: {
    workspaceId: string;
    eventName: OrgChartEmbedWebhookEventName;
    record: Record<string, unknown>;
  }): Promise<void> {
    try {
      const webhookRepository =
        await this.twentyORMGlobalManager.getRepositoryForWorkspace<WebhookWorkspaceEntity>(
          input.workspaceId,
          'webhook',
        );

      const webhooks = await webhookRepository.find({
        where: [
          { operations: ArrayContains([input.eventName]) },
          { operations: ArrayContains(['embed.*']) },
          { operations: ArrayContains(['*.*']) },
        ],
      });

      if (webhooks.length === 0) {
        return;
      }

      for (const webhook of webhooks) {
        const jobData: CallWebhookJobData = {
          targetUrl: webhook.targetUrl,
          eventName: input.eventName,
          objectMetadata: {
            id: webhook.id,
            nameSingular: 'embed',
          },
          workspaceId: input.workspaceId,
          webhookId: webhook.id,
          eventDate: new Date(),
          record: input.record,
          secret: webhook.secret,
        };

        await this.messageQueueService.add(CallWebhookJob.name, jobData);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to emit embed webhook event ${input.eventName}`,
        error as Error,
      );
    }
  }
}
