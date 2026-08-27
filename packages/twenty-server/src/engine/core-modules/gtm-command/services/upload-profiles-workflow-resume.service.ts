import { Injectable, Logger } from '@nestjs/common';

import { StepStatus } from 'twenty-shared/workflow';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { WorkflowRunStatus } from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';
import { RunWorkflowJob } from 'src/modules/workflow/workflow-runner/jobs/run-workflow.job';
import { type RunWorkflowJobData } from 'src/modules/workflow/workflow-runner/types/run-workflow-job-data.type';
import { buildRunWorkflowJobOptions } from 'src/modules/workflow/workflow-runner/utils/build-run-workflow-job-options.util';
import { WorkflowRunWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.workspace-service';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export type WorkflowUploadCorrelation = {
  workflowRunId: string;
  workflowStepId: string;
  workspaceId: string;
  projectId: string;
  uploadSessionId: string;
  totalBatches: number;
};

@Injectable()
export class UploadProfilesWorkflowResumeService {
  private readonly logger = new Logger(
    UploadProfilesWorkflowResumeService.name,
  );

  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineGtmCommand)
    private readonly cache: CacheStorageService,
    private readonly workflowRunWorkspaceService: WorkflowRunWorkspaceService,
    @InjectMessageQueue(MessageQueue.workflowQueue)
    private readonly workflowQueue: MessageQueueService,
  ) {}

  private idsKey(uploadSessionId: string): string {
    return `upload-wf:${uploadSessionId}:ids`;
  }

  private doneKey(uploadSessionId: string): string {
    return `upload-wf:${uploadSessionId}:done`;
  }

  private finalizedKey(uploadSessionId: string): string {
    return `upload-wf:${uploadSessionId}:finalized`;
  }

  async recordBatchSuccess({
    correlation,
    candidateIds,
    batchNumber,
  }: {
    correlation: WorkflowUploadCorrelation;
    candidateIds: string[];
    batchNumber: number;
  }): Promise<void> {
    const { uploadSessionId, totalBatches } = correlation;

    if (candidateIds.length > 0) {
      await this.cache.setAdd(
        this.idsKey(uploadSessionId),
        candidateIds,
        SESSION_TTL_MS,
      );
    }

    await this.cache.setAdd(
      this.doneKey(uploadSessionId),
      [String(batchNumber)],
      SESSION_TTL_MS,
    );

    const completedCount = await this.cache.getSetLength(
      this.doneKey(uploadSessionId),
    );

    if (completedCount < totalBatches) {
      this.logger.log(
        `upload-profiles workflow session ${uploadSessionId}: ${completedCount}/${totalBatches} batches done`,
      );

      return;
    }

    await this.finalizeSuccess(correlation);
  }

  async recordBatchFailure({
    correlation,
    errorMessage,
    isTerminalAttempt,
  }: {
    correlation: WorkflowUploadCorrelation;
    errorMessage: string;
    isTerminalAttempt: boolean;
  }): Promise<void> {
    if (!isTerminalAttempt) {
      return;
    }

    const claimed = await this.cache.setIfAbsent(
      this.finalizedKey(correlation.uploadSessionId),
      'failed',
      SESSION_TTL_MS,
    );

    if (!claimed) {
      return;
    }

    this.logger.error(
      `upload-profiles workflow session ${correlation.uploadSessionId} failed: ${errorMessage}`,
    );

    try {
      await this.workflowRunWorkspaceService.updateWorkflowRunStepInfo({
        stepId: correlation.workflowStepId,
        stepInfo: {
          status: StepStatus.FAILED,
          error: errorMessage,
        },
        workspaceId: correlation.workspaceId,
        workflowRunId: correlation.workflowRunId,
      });

      await this.workflowRunWorkspaceService.endWorkflowRun({
        workspaceId: correlation.workspaceId,
        workflowRunId: correlation.workflowRunId,
        status: WorkflowRunStatus.FAILED,
        error: errorMessage,
      });
    } catch (error) {
      this.logger.error(
        `Failed to mark upload-profiles workflow step as failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async finalizeSuccess(
    correlation: WorkflowUploadCorrelation,
  ): Promise<void> {
    const claimed = await this.cache.setIfAbsent(
      this.finalizedKey(correlation.uploadSessionId),
      'success',
      SESSION_TTL_MS,
    );

    if (!claimed) {
      return;
    }

    const candidateIds = await this.cache.setMembers(
      this.idsKey(correlation.uploadSessionId),
    );

    const result = {
      success: true,
      queued: candidateIds.length,
      created: candidateIds.length,
      candidateIds,
      projectId: correlation.projectId,
      uploadSessionId: correlation.uploadSessionId,
      error: '',
    };

    try {
      await this.workflowRunWorkspaceService.updateWorkflowRunStepInfo({
        stepId: correlation.workflowStepId,
        stepInfo: {
          status: StepStatus.SUCCESS,
          result,
        },
        workspaceId: correlation.workspaceId,
        workflowRunId: correlation.workflowRunId,
      });

      await this.workflowQueue.add<RunWorkflowJobData>(
        RunWorkflowJob.name,
        {
          workspaceId: correlation.workspaceId,
          workflowRunId: correlation.workflowRunId,
          lastExecutedStepId: correlation.workflowStepId,
        },
        buildRunWorkflowJobOptions(correlation.workflowRunId),
      );

      this.logger.log(
        `upload-profiles workflow session ${correlation.uploadSessionId} resumed with ${candidateIds.length} candidates`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to resume upload-profiles workflow: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      await this.cache.del(this.finalizedKey(correlation.uploadSessionId));
    }
  }
}
