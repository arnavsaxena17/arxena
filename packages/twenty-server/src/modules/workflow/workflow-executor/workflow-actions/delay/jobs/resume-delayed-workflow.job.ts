import { Scope } from '@nestjs/common';

import { StepStatus } from 'twenty-shared/workflow';

import { InjectMessageQueue } from 'src/engine/core-modules/message-queue/decorators/message-queue.decorator';
import { Process } from 'src/engine/core-modules/message-queue/decorators/process.decorator';
import { Processor } from 'src/engine/core-modules/message-queue/decorators/processor.decorator';
import { MessageQueue } from 'src/engine/core-modules/message-queue/message-queue.constants';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { WorkflowRunStatus } from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';
import { RESUME_DELAYED_WORKFLOW_JOB_NAME } from 'src/modules/workflow/workflow-executor/workflow-actions/delay/contants/resume-delayed-workflow-job-name';
import { ResumeDelayedWorkflowJobData } from 'src/modules/workflow/workflow-executor/workflow-actions/delay/types/resume-delayed-workflow-job-data.type';
import { RUN_WORKFLOW_JOB_NAME } from 'src/modules/workflow/workflow-runner/constants/run-workflow-job-name';
import {
  WorkflowRunException,
  WorkflowRunExceptionCode,
} from 'src/modules/workflow/workflow-runner/exceptions/workflow-run.exception';
import { type RunWorkflowJobData } from 'src/modules/workflow/workflow-runner/types/run-workflow-job-data.type';
import { buildRunWorkflowJobOptions } from 'src/modules/workflow/workflow-runner/utils/build-run-workflow-job-options.util';
import { WorkflowRunWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.workspace-service';

@Processor({
  queueName: MessageQueue.delayedJobsQueue,
  scope: Scope.REQUEST,
})
export class ResumeDelayedWorkflowJob {
  constructor(
    @InjectMessageQueue(MessageQueue.workflowQueue)
    private readonly messageQueueService: MessageQueueService,
    private readonly workflowRunWorkspaceService: WorkflowRunWorkspaceService,
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  @Process(RESUME_DELAYED_WORKFLOW_JOB_NAME)
  async handle({
    workspaceId,
    workflowRunId,
    stepId,
    retryPendingStep,
  }: ResumeDelayedWorkflowJobData): Promise<void> {
    const authContext = buildSystemAuthContext(workspaceId);

    await this.globalWorkspaceOrmManager.executeInWorkspaceContext(async () => {
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
          (step) => step.id === stepId,
        );

        const stepInfo = workflowRun.state?.stepInfos[stepId];

        if (!step || stepInfo?.status !== StepStatus.PENDING) {
          throw new WorkflowRunException(
            'Step not found or is not pending',
            WorkflowRunExceptionCode.INVALID_OPERATION,
          );
        }

        if (retryPendingStep === true) {
          await this.workflowRunWorkspaceService.updateWorkflowRunStepInfo({
            stepId,
            stepInfo: {
              status: StepStatus.NOT_STARTED,
            },
            workspaceId,
            workflowRunId,
          });

          await this.messageQueueService.add<RunWorkflowJobData>(
            RUN_WORKFLOW_JOB_NAME,
            {
              workspaceId,
              workflowRunId,
              stepIdsToRetry: [stepId],
            },
            buildRunWorkflowJobOptions(workflowRunId),
          );

          return;
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
          buildRunWorkflowJobOptions(workflowRunId),
        );
      } catch (error) {
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
    }, authContext);
  }
}
