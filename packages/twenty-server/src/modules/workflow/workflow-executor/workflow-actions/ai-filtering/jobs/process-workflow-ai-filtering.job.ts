import { Injectable } from '@nestjs/common';

import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { type ProcessWorkflowAiFilteringJobData } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-filtering/types/process-workflow-ai-filtering-job-data.type';
import { WorkflowAiFilteringService } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-filtering/workflow-ai-filtering.service';

@Processor(MessageQueue.aiFilteringQueue)
@Injectable()
export class ProcessWorkflowAiFilteringJob {
  constructor(
    private readonly workflowAiFilteringService: WorkflowAiFilteringService,
  ) {}

  @Process(ProcessWorkflowAiFilteringJob.name)
  async handle(jobData: ProcessWorkflowAiFilteringJobData): Promise<void> {
    await this.workflowAiFilteringService.processQueuedJob(jobData);
  }
}
