import { Logger, Scope } from '@nestjs/common';

import { StepStatus } from 'twenty-shared';

import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { WorkflowRunStatus } from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';
import { RESUME_DELAYED_WORKFLOW_JOB_NAME } from 'src/modules/workflow/workflow-executor/workflow-actions/delay/contants/resume-delayed-workflow-job-name';
import { isWorkflowDelayAction } from 'src/modules/workflow/workflow-executor/workflow-actions/delay/guards/is-workflow-delay-action.guard';
import { type ResumeDelayedWorkflowJobData } from 'src/modules/workflow/workflow-executor/workflow-actions/delay/types/resume-delayed-workflow-job-data.type';
import { RUN_WORKFLOW_JOB_NAME } from 'src/modules/workflow/workflow-runner/constants/run-workflow-job-name';
import {
  WorkflowRunException,
  WorkflowRunExceptionCode,
} from 'src/modules/workflow/workflow-runner/exceptions/workflow-run.exception';
import { type RunWorkflowJobData } from 'src/modules/workflow/workflow-runner/types/run-workflow-job-data.type';
import { WorkflowRunWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.workspace-service';

@Processor({
  queueName: MessageQueue.delayedJobsQueue,
  scope: Scope.REQUEST,
})
export class ResumeDelayedWorkflowJob {
  private readonly logger = new Logger(ResumeDelayedWorkflowJob.name);

  constructor(
    @InjectMessageQueue(MessageQueue.workflowQueue)
    private readonly messageQueueService: MessageQueueService,
    private readonly workflowRunWorkspaceService: WorkflowRunWorkspaceService,
  ) {}

  @Process(RESUME_DELAYED_WORKFLOW_JOB_NAME)
  async handle({
    workspaceId,
    workflowRunId,
    stepId,
  }: ResumeDelayedWorkflowJobData): Promise<void> {
    try {
      const workflowRun =
        await this.workflowRunWorkspaceService.getWorkflowRunOrFail({
          workflowRunId,
          workspaceId,
        });

      if (workflowRun.status !== WorkflowRunStatus.RUNNING) {
        return;
      }

      const step = workflowRun.state?.flow?.steps?.find(
        (candidate) => candidate.id === stepId,
      );

      const stepInfo = workflowRun.state?.stepInfos[stepId];

      if (!step || !isWorkflowDelayAction(step)) {
        throw new WorkflowRunException(
          'Step not found or is not a delay action',
          WorkflowRunExceptionCode.INVALID_OPERATION,
        );
      }

      if (stepInfo?.status !== StepStatus.PENDING) {
        throw new WorkflowRunException(
          'Step is not pending',
          WorkflowRunExceptionCode.INVALID_OPERATION,
        );
      }

      await this.workflowRunWorkspaceService.updateWorkflowRunStepInfo({
        stepId,
        stepInfo: {
          status: StepStatus.SUCCESS,
          result: {
            success: true,
          },
        },
        workspaceId,
        workflowRunId,
      });

      await this.messageQueueService.add<RunWorkflowJobData>(
        RUN_WORKFLOW_JOB_NAME,
        {
          workspaceId,
          workflowRunId,
          lastExecutedStepId: stepId,
        },
      );
    } catch (error) {
      this.logger.error(
        `Error resuming delayed workflow run ${workflowRunId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      await this.workflowRunWorkspaceService.endWorkflowRun({
        workflowRunId,
        workspaceId,
        status: WorkflowRunStatus.FAILED,
        error:
          error instanceof Error
            ? error.message
            : `Error during delay resume: ${String(error)}`,
        isSystemError: true,
      });

      throw error;
    }
  }
}
