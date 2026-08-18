import { Injectable, Logger } from '@nestjs/common';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import {
  GTM_INBOUND_REPLY_WINDOW_JOB_NAME,
  type GtmInboundReplyWindowJobData,
} from 'src/engine/core-modules/gtm-command/jobs/gtm-inbound-reply-window.job-constants';
import { GtmCommandMaterializeService } from 'src/engine/core-modules/gtm-command/services/gtm-command-materialize.service';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';

const DEFAULT_DELAY_MINUTES = 2;
const MIN_DELAY_MINUTES = 1;
const MAX_DELAY_MINUTES = 60;

@Injectable()
@Processor(MessageQueue.delayedJobsQueue)
export class GtmInboundReplyWindowService {
  private readonly logger = new Logger(GtmInboundReplyWindowService.name);

  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineGtmCommand)
    private readonly cache: CacheStorageService,
    @InjectMessageQueue(MessageQueue.delayedJobsQueue)
    private readonly delayedQueue: MessageQueueService,
    private readonly gtmCommandMaterializeService: GtmCommandMaterializeService,
  ) {}

  async schedule({
    workspaceId,
    candidateId,
    delayMinutes,
    apiToken,
  }: {
    workspaceId: string;
    candidateId: string;
    delayMinutes?: number | null;
    apiToken?: string;
  }): Promise<void> {
    const minutes = Math.min(
      MAX_DELAY_MINUTES,
      Math.max(MIN_DELAY_MINUTES, delayMinutes ?? DEFAULT_DELAY_MINUTES),
    );
    const generationKey = this.generationKey(workspaceId, candidateId);
    const previous = (await this.cache.get<number>(generationKey)) ?? 0;
    const generation = previous + 1;
    const ttlMs = minutes * 60 * 1000 + 60_000;

    await this.cache.set(generationKey, generation, ttlMs);

    await this.delayedQueue.add<GtmInboundReplyWindowJobData>(
      GTM_INBOUND_REPLY_WINDOW_JOB_NAME,
      {
        workspaceId,
        candidateId,
        generation,
        apiToken,
      },
      {
        delay: minutes * 60 * 1000,
      },
    );

    this.logger.log(
      `Scheduled GTM inbound window ${workspaceId}:${candidateId} gen=${generation} delay=${minutes}m`,
    );
  }

  @Process(GTM_INBOUND_REPLY_WINDOW_JOB_NAME)
  async handle(jobData: GtmInboundReplyWindowJobData): Promise<void> {
    const { workspaceId, candidateId, generation, apiToken } = jobData;
    const current =
      (await this.cache.get<number>(this.generationKey(workspaceId, candidateId))) ??
      0;

    if (current !== generation) {
      this.logger.log(
        `Skipping stale GTM inbound flush ${workspaceId}:${candidateId} jobGen=${generation} current=${current}`,
      );

      return;
    }

    if (!apiToken) {
      this.logger.warn(
        `GTM inbound flush missing apiToken for ${candidateId}`,
      );

      return;
    }

    await this.gtmCommandMaterializeService.applyCandidateEvent({
      candidateId,
      event: 'inbound_reply_flush',
      apiToken,
    });

    await this.cache.del(this.generationKey(workspaceId, candidateId));
  }

  private generationKey(workspaceId: string, candidateId: string): string {
    return `gtm-inbound:${workspaceId}:${candidateId}`;
  }
}
