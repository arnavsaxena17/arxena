import { Injectable, Logger } from '@nestjs/common';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import {
  OUTREACH_INBOUND_REPLY_WINDOW_JOB_NAME,
  type OutreachInboundReplyWindowJobData,
  type InboundReplyWindowChannel,
  type InboundReplyWindowKind,
} from 'src/engine/core-modules/outreach-command/jobs/outreach-inbound-reply-window.job-constants';
import { OutreachCommandMaterializeService } from 'src/engine/core-modules/outreach-command/services/outreach-command-materialize.service';
import { OutreachInboundReplyClassifierService } from 'src/engine/core-modules/outreach-command/services/outreach-inbound-reply-classifier.service';
import { OutreachMessagePersistService } from 'src/engine/core-modules/outreach-command/services/outreach-message-persist.service';
import {
  clampInboundWindowDelayMinutes,
  inboundWindowTtlMs,
  isCurrentInboundGeneration,
  unionInboundTurns,
  type InboundBufferedTurn,
} from 'src/engine/core-modules/outreach-command/utils/inbound-reply-window.util';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import type { EngagedCandidateJobData } from 'src/engine/core-modules/arx-chat/services/candidate-engagement/engaged-candidate-processor.job';

@Injectable()
@Processor(MessageQueue.delayedJobsQueue)
export class OutreachInboundReplyWindowService {
  private readonly logger = new Logger(OutreachInboundReplyWindowService.name);

  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineOutreachCommand)
    private readonly cache: CacheStorageService,
    @InjectMessageQueue(MessageQueue.delayedJobsQueue)
    private readonly delayedQueue: MessageQueueService,
    @InjectMessageQueue(MessageQueue.engagedCandidateProcessingQueue)
    private readonly engagedCandidateQueue: MessageQueueService,
    private readonly gtmCommandMaterializeService: OutreachCommandMaterializeService,
    private readonly gtmOutreachMessagePersistService: OutreachMessagePersistService,
    private readonly gtmInboundReplyClassifierService: OutreachInboundReplyClassifierService,
  ) {}

  async schedule({
    workspaceId,
    candidateId,
    delayMinutes,
    apiToken,
    kind = 'outreach',
    channel = 'WHATSAPP',
    turn,
    chatId,
  }: {
    workspaceId: string;
    candidateId: string;
    delayMinutes?: number | null;
    apiToken?: string;
    kind?: InboundReplyWindowKind;
    channel?: InboundReplyWindowChannel;
    turn?: InboundBufferedTurn;
    chatId?: string;
  }): Promise<void> {
    const minutes = clampInboundWindowDelayMinutes(delayMinutes);
    const ttlMs = inboundWindowTtlMs(minutes);
    const generationKey = this.generationKey(workspaceId, candidateId);
    const turnsKey = this.turnsKey(workspaceId, candidateId);
    const previous = (await this.cache.get<number>(generationKey)) ?? 0;
    const generation = previous + 1;
    const existingTurns =
      (await this.cache.get<InboundBufferedTurn[]>(turnsKey)) ?? [];
    const turns = turn
      ? unionInboundTurns(existingTurns, [turn])
      : existingTurns;

    await this.cache.set(generationKey, generation, ttlMs);
    await this.cache.set(turnsKey, turns, ttlMs);

    await this.delayedQueue.add<OutreachInboundReplyWindowJobData>(
      OUTREACH_INBOUND_REPLY_WINDOW_JOB_NAME,
      {
        workspaceId,
        candidateId,
        generation,
        apiToken,
        kind,
        channel,
        turns,
        chatId,
      },
      {
        delay: minutes * 60 * 1000,
      },
    );

    this.logger.log(
      `Scheduled inbound window ${kind} ${workspaceId}:${candidateId} gen=${generation} delay=${minutes}m turns=${turns.length}`,
    );
  }

  @Process(OUTREACH_INBOUND_REPLY_WINDOW_JOB_NAME)
  async handle(jobData: OutreachInboundReplyWindowJobData): Promise<void> {
    const {
      workspaceId,
      candidateId,
      generation,
      apiToken,
      kind = 'outreach',
      channel = 'WHATSAPP',
      turns: jobTurns = [],
      chatId,
    } = jobData;
    const current = await this.cache.get<number>(
      this.generationKey(workspaceId, candidateId),
    );

    if (!isCurrentInboundGeneration(generation, current)) {
      this.logger.log(
        `Skipping stale inbound flush ${workspaceId}:${candidateId} jobGen=${generation} current=${current}`,
      );

      return;
    }

    const cachedTurns =
      (await this.cache.get<InboundBufferedTurn[]>(
        this.turnsKey(workspaceId, candidateId),
      )) ?? [];
    const turns = unionInboundTurns(jobTurns, cachedTurns);

    if (turns.length === 0) {
      this.logger.warn(
        `Inbound flush skipped empty burst for ${candidateId}`,
      );
      await this.clearWindow(workspaceId, candidateId);

      return;
    }

    await this.gtmOutreachMessagePersistService.persistInboundFlush({
      workspaceId,
      candidateId,
      channel,
      chatId,
      turns: turns.map((turn) => ({
        role: turn.role,
        content: turn.content,
        id: turn.externalMessageId,
        timestamp: turn.receivedAt,
      })),
    });

    // Legacy buffered jobs used kind 'gtm' before InboundReplyWindowKind was narrowed.
    if (kind === 'outreach' || kind === 'gtm') {
      let token = apiToken;

      if (!token) {
        this.logger.warn(
          `GTM inbound flush missing apiToken for ${candidateId}`,
        );
      } else {
        const classification =
          await this.gtmInboundReplyClassifierService.classifyTurns({
            workspaceId,
            turns,
          });
        const event =
          classification.stage === 'MEETING_BOOKED'
            ? 'meeting_booked'
            : 'inbound_reply_flush';

        this.logger.log(
          `GTM inbound flush ${candidateId} intent=${classification.intent} stage=${classification.stage}`,
        );

        await this.gtmCommandMaterializeService.applyCandidateEvent({
          candidateId,
          event,
          apiToken: token,
          classifiedOutreachStage: classification.stage,
        });
      }
    } else if (apiToken) {
      await this.engagedCandidateQueue.add<EngagedCandidateJobData>(
        'EngagedCandidateProcessor',
        {
          candidateId,
          workspaceId,
          timestamp: Date.now(),
          apiToken,
          isIncomingMessage: true,
          processImmediately: true,
        },
        {
          priority: 1,
          id: `engaged-candidate-flush-${candidateId}-${generation}`,
        },
      );
    }

    await this.clearWindow(workspaceId, candidateId);
  }

  private async clearWindow(
    workspaceId: string,
    candidateId: string,
  ): Promise<void> {
    await this.cache.del(this.generationKey(workspaceId, candidateId));
    await this.cache.del(this.turnsKey(workspaceId, candidateId));
  }

  private generationKey(workspaceId: string, candidateId: string): string {
    return `outreach-inbound:${workspaceId}:${candidateId}`;
  }

  private turnsKey(workspaceId: string, candidateId: string): string {
    return `outreach-inbound-turns:${workspaceId}:${candidateId}`;
  }
}
