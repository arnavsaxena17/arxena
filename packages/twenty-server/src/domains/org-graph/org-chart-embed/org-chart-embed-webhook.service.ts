import { Injectable, Logger } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';

import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { CallWebhookJob } from 'src/engine/metadata-modules/webhook/jobs/call-webhook.job';
import { type CallWebhookJobData } from 'src/engine/metadata-modules/webhook/types/webhook-job-data.type';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';

export type OrgChartEmbedWebhookEventName =
  | 'embed.viewed'
  | 'embed.node_clicked';

@Injectable()
export class OrgChartEmbedWebhookService {
  private readonly logger = new Logger(OrgChartEmbedWebhookService.name);

  constructor(
    @InjectMessageQueue(MessageQueue.webhookQueue)
    private readonly messageQueueService: MessageQueueService,
    private readonly workspaceCacheService: WorkspaceCacheService,
  ) {}

  async emitEmbedEvent(input: {
    workspaceId: string;
    eventName: OrgChartEmbedWebhookEventName;
    record: Record<string, unknown>;
  }): Promise<void> {
    try {
      const operationsToMatch = [
        input.eventName,
        'embed.*',
        '*.*',
      ];

      const { flatWebhookMaps } =
        await this.workspaceCacheService.getOrRecompute(input.workspaceId, [
          'flatWebhookMaps',
        ]);

      const webhooks = Object.values(flatWebhookMaps.byUniversalIdentifier)
        .filter(isDefined)
        .filter((webhook) =>
          operationsToMatch.some((operationToMatch) =>
            webhook.operations.includes(operationToMatch),
          ),
        );

      if (webhooks.length === 0) {
        return;
      }

      const webhookEvents: CallWebhookJobData[] = webhooks.map((webhook) => ({
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
        secret: webhook.secret ?? undefined,
      }));

      await this.messageQueueService.add<CallWebhookJobData[]>(
        CallWebhookJob.name,
        webhookEvents,
        { retryLimit: 3 },
      );
    } catch (error) {
      this.logger.warn(
        `Failed to emit embed webhook event ${input.eventName}`,
        error as Error,
      );
    }
  }
}
