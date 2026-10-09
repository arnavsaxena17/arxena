import { Injectable } from '@nestjs/common';

import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import {
  OUTREACH_AI_COLUMN_CHUNK_JOB_NAME,
  type OutreachAiColumnChunkJobData,
  OutreachAiColumnRunService,
} from 'src/engine/core-modules/outreach-command/services/outreach-ai-column-run.service';

// Shares the existing AI filtering queue (jobs are routed by name), one chunk
// per job so a long column never blocks the workflow AI filtering jobs.
@Processor(MessageQueue.aiFilteringQueue)
@Injectable()
export class ProcessOutreachAiColumnChunkJob {
  constructor(
    private readonly outreachAiColumnRunService: OutreachAiColumnRunService,
  ) {}

  @Process(OUTREACH_AI_COLUMN_CHUNK_JOB_NAME)
  async handle(jobData: OutreachAiColumnChunkJobData): Promise<void> {
    await this.outreachAiColumnRunService.processChunk(jobData.runId);
  }
}
