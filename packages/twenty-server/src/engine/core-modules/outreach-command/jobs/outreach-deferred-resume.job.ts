import { Injectable, Logger } from '@nestjs/common';

import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import {
  OUTREACH_DEFERRED_RESUME_JOB_NAME,
  type OutreachDeferredResumeJobData,
  OutreachDeferredResumeService,
} from 'src/engine/core-modules/outreach-command/services/outreach-deferred-resume.service';

@Injectable()
@Processor(MessageQueue.delayedJobsQueue)
export class OutreachDeferredResumeJob {
  private readonly logger = new Logger(OutreachDeferredResumeJob.name);

  constructor(
    private readonly outreachDeferredResumeService: OutreachDeferredResumeService,
  ) {}

  @Process(OUTREACH_DEFERRED_RESUME_JOB_NAME)
  async handle(jobData: OutreachDeferredResumeJobData): Promise<void> {
    const { workspaceId, candidateId } = jobData;

    this.logger.log(
      `Processing deferred resume for candidate ${candidateId} in workspace ${workspaceId}`,
    );

    await this.outreachDeferredResumeService.resumeCandidateById({
      workspaceId,
      candidateId,
    });
  }
}
