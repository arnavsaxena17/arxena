/* @license Enterprise */

import { Injectable, Logger } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';

import { OnCustomBatchEvent } from 'src/engine/api/graphql/graphql-query-runner/decorators/on-custom-batch-event.decorator';
import { EventLogEmitterService } from 'src/engine/core-modules/event-logs/emit/event-log-emitter.service';
import { type WorkspaceEventEnvelope } from 'src/engine/core-modules/event-logs/types/workspace-event-envelope.type';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { USAGE_RECORDED } from 'src/engine/core-modules/usage/constants/usage-recorded.constant';
import { USAGE_EVENT_RETRY_BASE_DELAY_MS } from 'src/engine/core-modules/usage/constants/usage-event-retry.constant';
import {
  UsageEventRetryJob,
  type UsageEventRetryJobData,
} from 'src/engine/core-modules/usage/jobs/usage-event-retry.job';
import { type UsageEvent } from 'src/engine/core-modules/usage/types/usage-event.type';
import { buildUsageEventEnvelopes } from 'src/engine/core-modules/usage/utils/build-usage-event-envelopes';
import { CustomWorkspaceEventBatch } from 'src/engine/workspace-event-emitter/types/custom-workspace-batch-event.type';

@Injectable()
export class UsageEventListener {
  private readonly logger = new Logger(UsageEventListener.name);

  constructor(
    private readonly eventLogEmitterService: EventLogEmitterService,
    @InjectMessageQueue(MessageQueue.billingQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {}

  @OnCustomBatchEvent(USAGE_RECORDED)
  async handleUsageRecordedEvent(
    payload: CustomWorkspaceEventBatch<UsageEvent>,
  ): Promise<void> {
    if (
      !isDefined(payload.workspaceId) ||
      !this.eventLogEmitterService.isEnabled()
    ) {
      return;
    }

    const envelopes = buildUsageEventEnvelopes(
      payload.workspaceId,
      payload.events,
    );

    try {
      await this.eventLogEmitterService.dispatch(envelopes);
    } catch (error) {
      // Never fail the emitting flow, but do not drop the charge either:
      // usage in ClickHouse is what the balance is computed from.
      this.logger.error(
        'Failed to record usage events; scheduling retry',
        error,
      );

      await this.scheduleRetry(payload.workspaceId, envelopes);
    }
  }

  private async scheduleRetry(
    workspaceId: string,
    envelopes: WorkspaceEventEnvelope[],
  ): Promise<void> {
    try {
      await this.messageQueueService.add<UsageEventRetryJobData>(
        UsageEventRetryJob.name,
        { workspaceId, envelopes, attempt: 1 },
        { delay: USAGE_EVENT_RETRY_BASE_DELAY_MS },
      );
    } catch (error) {
      this.logger.error(
        `Could not schedule usage event retry for workspace ${workspaceId}. payload=${JSON.stringify(envelopes)}`,
        error,
      );
    }
  }
}
