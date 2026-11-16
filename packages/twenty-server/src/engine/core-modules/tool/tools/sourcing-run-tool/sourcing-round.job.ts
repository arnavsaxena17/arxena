import { Injectable } from '@nestjs/common';

import {
  SOURCING_ROUND_JOB_NAME,
  SourcingRunService,
  type SourcingRoundJobData,
} from 'src/engine/core-modules/candidate-sourcing/run/sourcing-run.service';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';

// One round of a sourcing run per job, on the queue the people lookups and AI
// column runs share (jobs are routed by name)
@Processor(MessageQueue.aiFilteringQueue)
@Injectable()
export class SourcingRoundJob {
  constructor(private readonly sourcingRunService: SourcingRunService) {}

  @Process(SOURCING_ROUND_JOB_NAME)
  async handle(jobData: SourcingRoundJobData): Promise<void> {
    await this.sourcingRunService.runRound(jobData);
  }
}
