import { Injectable, Logger } from '@nestjs/common';

import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';

import {
  UNIPILE_WEBHOOK_PROCESSOR_NAME,
  type UnipileWebhookJobData,
} from '../types/unipile-webhook-job.types';
import type { UnipileNewRelationWebhook } from '../types/unipile-webhook.types';
import { UnipileWebhookService } from './unipile-webhook.service';

const parsedConcurrency = parseInt(
  process.env.UNIPILE_WEBHOOK_CONCURRENCY ?? '2',
  10,
);
const unipileWebhookConcurrency = Number.isFinite(parsedConcurrency)
  ? Math.max(1, parsedConcurrency)
  : 2;

const getWebhookEventLabel = (jobData: UnipileWebhookJobData): string => {
  if ('event' in jobData.payload) {
    return jobData.payload.event;
  }

  if ('AccountStatus' in jobData.payload) {
    return 'account_status';
  }

  return jobData.kind;
};

@Injectable()
@Processor(MessageQueue.unipileWebhookQueue)
export class UnipileWebhookProcessor {
  private readonly logger = new Logger(UnipileWebhookProcessor.name);

  constructor(private readonly unipileWebhookService: UnipileWebhookService) {}

  @Process({
    jobName: UNIPILE_WEBHOOK_PROCESSOR_NAME,
    concurrency: unipileWebhookConcurrency,
  })
  async handle(jobData: UnipileWebhookJobData): Promise<void> {
    const eventLabel = getWebhookEventLabel(jobData);

    this.logger.log(
      `Processing queued Unipile webhook kind=${jobData.kind} event=${eventLabel} receivedAt=${jobData.receivedAt}`,
    );

    if (jobData.kind === 'relations') {
      await this.unipileWebhookService.processNewRelationWebhook(
        jobData.payload as UnipileNewRelationWebhook,
      );
      return;
    }

    await this.unipileWebhookService.processWebhook(jobData.payload);
  }
}
