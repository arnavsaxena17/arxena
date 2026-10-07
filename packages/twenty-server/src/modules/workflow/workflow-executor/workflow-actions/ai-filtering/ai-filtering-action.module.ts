import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AiFilterContextService } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-filtering/ai-filter-context.service';

import { CandidateSourcingModule } from 'src/engine/core-modules/candidate-sourcing/candidate-sourcing.module';
import { MessageQueueModule } from 'src/engine/core-modules/message-queue/message-queue.module';
import { AiFilteringWorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-filtering/ai-filtering.workflow-action';
import { AiFilteringWorkflowResumeService } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-filtering/ai-filtering-workflow-resume.service';
import { ProcessWorkflowAiFilteringJob } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-filtering/jobs/process-workflow-ai-filtering.job';
import { WorkflowAiFilteringService } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-filtering/workflow-ai-filtering.service';
import { WorkflowRunModule } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkspaceEntity]),
    CandidateSourcingModule,
    WorkflowRunModule,
    MessageQueueModule,
  ],
  providers: [
    AiFilteringWorkflowAction,
    WorkflowAiFilteringService,
    AiFilterContextService,
    AiFilteringWorkflowResumeService,
    ProcessWorkflowAiFilteringJob,
  ],
  exports: [AiFilteringWorkflowAction, WorkflowAiFilteringService],
})
export class AiFilteringActionModule {}
