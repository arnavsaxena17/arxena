import { LINKEDIN_RATE_LIMIT_PENDING_REASON } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { type WorkflowActionOutput } from 'src/modules/workflow/workflow-executor/types/workflow-action-output.type';
import { RESUME_DELAYED_WORKFLOW_JOB_NAME } from 'src/modules/workflow/workflow-executor/workflow-actions/delay/contants/resume-delayed-workflow-job-name';
import { ResumeDelayedWorkflowJobData } from 'src/modules/workflow/workflow-executor/workflow-actions/delay/types/resume-delayed-workflow-job-data.type';
import { buildRunWorkflowJobOptions } from 'src/modules/workflow/workflow-runner/utils/build-run-workflow-job-options.util';

export const deferWorkflowForAccountRateLimit = async ({
  delayedQueue,
  waitMs,
  currentStepId,
  workspaceId,
  workflowRunId,
  pendingReason = LINKEDIN_RATE_LIMIT_PENDING_REASON,
}: {
  delayedQueue: MessageQueueService;
  waitMs: number;
  currentStepId: string;
  workspaceId: string;
  workflowRunId: string;
  pendingReason?: string;
}): Promise<WorkflowActionOutput> => {
  await delayedQueue.add<ResumeDelayedWorkflowJobData>(
    RESUME_DELAYED_WORKFLOW_JOB_NAME,
    {
      workspaceId,
      workflowRunId,
      stepId: currentStepId,
      retryPendingStep: true,
    },
    {
      ...buildRunWorkflowJobOptions(workflowRunId),
      delay: waitMs,
    },
  );

  return {
    pendingEvent: true,
    waitMs,
    scheduledAt: new Date(Date.now() + waitMs).toISOString(),
    pendingReason,
  };
};
