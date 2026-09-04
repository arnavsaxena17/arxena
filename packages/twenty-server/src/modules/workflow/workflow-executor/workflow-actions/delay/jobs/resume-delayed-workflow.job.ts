import { Scope } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';
import { StepStatus } from 'twenty-shared/workflow';
import { type ObjectLiteral } from 'typeorm';

import { OUTREACH_PROJECT_PAUSED_PENDING_REASON } from 'src/engine/core-modules/outreach-command/services/outreach-throttle.service';
import { buildWorkflowRunStepDeferralClearPatch } from 'src/engine/core-modules/outreach-command/utils/read-workflow-run-step-pending-fields.util';
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
import { type RunWorkflowJobData } from 'src/modules/workflow/workflow-runner/types/run-workflow-job-data.type';
import { buildRunWorkflowJobOptions } from 'src/modules/workflow/workflow-runner/utils/build-run-workflow-job-options.util';
import { WorkflowRunWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.workspace-service';

type ProjectPauseRecord = ObjectLiteral & {
  id: string;
  outreachStatus?: string | null;
};

type CandidatePauseRecord = ObjectLiteral & {
  id: string;
  projectsId?: string | null;
};

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
          // Stale timer fired after the step already advanced — no-op.
          return;
        }

        const projectPaused = await this.isRelatedProjectPaused({
          workspaceId,
          candidateId: workflowRun.candidateId ?? null,
        });

        if (projectPaused) {
          // Stale Bull delay fired while paused — re-park, do not send.
          await this.workflowRunWorkspaceService.updateWorkflowRunStepInfo({
            stepId,
            stepInfo: {
              ...stepInfo,
              status: StepStatus.PENDING,
              pendingReason: OUTREACH_PROJECT_PAUSED_PENDING_REASON,
              waitMs: 0,
            },
            workspaceId,
            workflowRunId,
          });

          return;
        }

        if (retryPendingStep === true) {
          await this.workflowRunWorkspaceService.updateWorkflowRunStepInfo({
            stepId,
            stepInfo: {
              status: StepStatus.NOT_STARTED,
              ...buildWorkflowRunStepDeferralClearPatch(),
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

  private async isRelatedProjectPaused({
    workspaceId,
    candidateId,
  }: {
    workspaceId: string;
    candidateId: string | null;
  }): Promise<boolean> {
    if (!isNonEmptyString(candidateId)) {
      return false;
    }

    const candidateRepository =
      await this.globalWorkspaceOrmManager.getRepository<CandidatePauseRecord>(
        workspaceId,
        'candidate',
        { shouldBypassPermissionChecks: true },
      );
    const candidate = await candidateRepository.findOne({
      where: { id: candidateId },
    });

    if (!isNonEmptyString(candidate?.projectsId)) {
      return false;
    }

    const projectRepository =
      await this.globalWorkspaceOrmManager.getRepository<ProjectPauseRecord>(
        workspaceId,
        'project',
        { shouldBypassPermissionChecks: true },
      );
    const project = await projectRepository.findOne({
      where: { id: candidate.projectsId },
    });

    return (project?.outreachStatus ?? 'LIVE').toUpperCase() === 'PAUSED';
  }
}
