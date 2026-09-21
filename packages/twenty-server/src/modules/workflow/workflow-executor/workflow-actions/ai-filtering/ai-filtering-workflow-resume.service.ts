import { Injectable, Logger } from '@nestjs/common';

import { StepStatus } from 'twenty-shared/workflow';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { WorkflowRunStatus } from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';
import { type WorkflowAiFilteringResult } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-filtering/types/workflow-ai-filtering-result.type';
import { buildRunWorkflowJobOptions } from 'src/modules/workflow/workflow-runner/utils/build-run-workflow-job-options.util';
import { WorkflowRunWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.workspace-service';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
// Avoid importing RunWorkflowJob (circular with WorkflowActionFactory).
const RUN_WORKFLOW_JOB_NAME = 'RunWorkflowJob';

@Injectable()
export class AiFilteringWorkflowResumeService {
  private readonly logger = new Logger(AiFilteringWorkflowResumeService.name);

  constructor(
    @InjectCacheStorage(CacheStorageNamespace.ModuleWorkflow)
    private readonly cache: CacheStorageService,
    private readonly workflowRunWorkspaceService: WorkflowRunWorkspaceService,
    @InjectMessageQueue(MessageQueue.workflowQueue)
    private readonly workflowQueue: MessageQueueService,
  ) {}

  private finalizedKey(sessionId: string): string {
    return `ai-filtering-wf:${sessionId}:finalized`;
  }

  async finalizeSuccess({
    workflowRunId,
    workflowStepId,
    workspaceId,
    sessionId,
    result,
  }: {
    workflowRunId: string;
    workflowStepId: string;
    workspaceId: string;
    sessionId: string;
    result: WorkflowAiFilteringResult;
  }): Promise<void> {
    const claimed = await this.cache.setIfAbsent(
      this.finalizedKey(sessionId),
      'success',
      SESSION_TTL_MS,
    );

    if (!claimed) {
      return;
    }

    try {
      await this.workflowRunWorkspaceService.updateWorkflowRunStepInfo({
        stepId: workflowStepId,
        stepInfo: {
          status: StepStatus.SUCCESS,
          result,
        },
        workspaceId,
        workflowRunId,
      });

      await this.workflowQueue.add(
        RUN_WORKFLOW_JOB_NAME,
        {
          workspaceId,
          workflowRunId,
          lastExecutedStepId: workflowStepId,
        },
        buildRunWorkflowJobOptions(workflowRunId),
      );

      this.logger.log(
        `AI filtering workflow session ${sessionId} resumed with ${result.total} candidates`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to resume AI filtering workflow: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      await this.cache.del(this.finalizedKey(sessionId));
    }
  }

  async finalizeFailure({
    workflowRunId,
    workflowStepId,
    workspaceId,
    sessionId,
    errorMessage,
  }: {
    workflowRunId: string;
    workflowStepId: string;
    workspaceId: string;
    sessionId: string;
    errorMessage: string;
  }): Promise<void> {
    const claimed = await this.cache.setIfAbsent(
      this.finalizedKey(sessionId),
      'failed',
      SESSION_TTL_MS,
    );

    if (!claimed) {
      return;
    }

    this.logger.error(
      `AI filtering workflow session ${sessionId} failed: ${errorMessage}`,
    );

    try {
      await this.workflowRunWorkspaceService.updateWorkflowRunStepInfo({
        stepId: workflowStepId,
        stepInfo: {
          status: StepStatus.FAILED,
          error: errorMessage,
        },
        workspaceId,
        workflowRunId,
      });

      await this.workflowRunWorkspaceService.endWorkflowRun({
        workspaceId,
        workflowRunId,
        status: WorkflowRunStatus.FAILED,
        error: errorMessage,
      });
    } catch (error) {
      this.logger.error(
        `Failed to mark AI filtering workflow step as failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
