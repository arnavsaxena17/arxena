import { LINKEDIN_RATE_LIMIT_PENDING_REASON } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';
import { MessageQueueService } from 'src/engine/core-modules/message-queue/services/message-queue.service';
import { type WorkflowActionOutput } from 'src/modules/workflow/workflow-executor/types/workflow-action-output.type';
import { scheduleResumeDelayedWorkflowJob } from 'src/modules/workflow/workflow-executor/workflow-actions/delay/utils/resume-delayed-workflow-job-scheduler.util';

export const deferWorkflowForAccountRateLimit = async ({
  delayedQueue,
  waitMs,
  currentStepId,
  workspaceId,
  workflowRunId,
  pendingReason = LINKEDIN_RATE_LIMIT_PENDING_REASON,
  method,
}: {
  delayedQueue: MessageQueueService;
  waitMs: number;
  currentStepId: string;
  workspaceId: string;
  workflowRunId: string;
  pendingReason?: string;
  method?: string;
}): Promise<WorkflowActionOutput> => {
  await scheduleResumeDelayedWorkflowJob({
    delayedQueue,
    data: {
      workspaceId,
      workflowRunId,
      stepId: currentStepId,
      retryPendingStep: true,
    },
    delay: waitMs,
  });

  return {
    pendingEvent: true,
    waitMs,
    scheduledAt: new Date(Date.now() + waitMs).toISOString(),
    pendingReason,
    ...(method ? { method } : {}),
  };
};
