/* @license Enterprise */

import { Logger, Scope } from '@nestjs/common';

import { EventLogEmitterService } from 'src/engine/core-modules/event-logs/emit/event-log-emitter.service';
import { type WorkspaceEventEnvelope } from 'src/engine/core-modules/event-logs/types/workspace-event-envelope.type';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import {
  USAGE_EVENT_RETRY_BASE_DELAY_MS,
  USAGE_EVENT_RETRY_MAX_ATTEMPTS,
} from 'src/engine/core-modules/usage/constants/usage-event-retry.constant';

export type UsageEventRetryJobData = {
  workspaceId: string;
  envelopes: WorkspaceEventEnvelope[];
  attempt: number;
};

export const getUsageEventRetryDelayMs = (attempt: number): number =>
  USAGE_EVENT_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1);

@Processor({
  queueName: MessageQueue.billingQueue,
  scope: Scope.REQUEST,
})
export class UsageEventRetryJob {
  private readonly logger = new Logger(UsageEventRetryJob.name);

  constructor(
    private readonly eventLogEmitterService: EventLogEmitterService,
    @InjectMessageQueue(MessageQueue.billingQueue)
    private readonly messageQueueService: MessageQueueService,
  ) {}

  @Process(UsageEventRetryJob.name)
  async handle(data: UsageEventRetryJobData): Promise<void> {
    try {
      await this.eventLogEmitterService.dispatch(data.envelopes);
    } catch (error) {
      if (data.attempt >= USAGE_EVENT_RETRY_MAX_ATTEMPTS) {
        // The payload is logged so the charge can be replayed by hand
        this.logger.error(
          `Giving up on usage events for workspace ${data.workspaceId} after ${data.attempt} attempts. payload=${JSON.stringify(data.envelopes)}`,
          error,
        );

        return;
      }

      const nextAttempt = data.attempt + 1;

      this.logger.warn(
        `Usage event write failed for workspace ${data.workspaceId} (attempt ${data.attempt}); retrying as attempt ${nextAttempt}`,
      );

      await this.messageQueueService.add<UsageEventRetryJobData>(
        UsageEventRetryJob.name,
        { ...data, attempt: nextAttempt },
        { delay: getUsageEventRetryDelayMs(data.attempt) },
      );
    }
  }
}
