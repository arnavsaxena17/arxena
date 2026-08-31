import { LINKEDIN_RATE_LIMIT_PENDING_REASON } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';
import { RESUME_DELAYED_WORKFLOW_JOB_NAME } from 'src/modules/workflow/workflow-executor/workflow-actions/delay/contants/resume-delayed-workflow-job-name';
import { deferWorkflowForAccountRateLimit } from 'src/modules/workflow/workflow-executor/utils/defer-workflow-for-account-rate-limit.util';

describe('deferWorkflowForAccountRateLimit', () => {
  const buildDelayedQueue = () => ({
    getInFlightJobs: jest.fn().mockResolvedValue([]),
    removeJob: jest.fn().mockResolvedValue(undefined),
    add: jest.fn().mockResolvedValue(undefined),
  });

  it('enqueues a delayed resume that retries the pending step', async () => {
    const delayedQueue = buildDelayedQueue();

    const output = await deferWorkflowForAccountRateLimit({
      delayedQueue: delayedQueue as never,
      waitMs: 5_000,
      currentStepId: 'step-1',
      workspaceId: 'ws-1',
      workflowRunId: 'run-1',
    });

    expect(delayedQueue.add).toHaveBeenCalledWith(
      RESUME_DELAYED_WORKFLOW_JOB_NAME,
      {
        workspaceId: 'ws-1',
        workflowRunId: 'run-1',
        stepId: 'step-1',
        retryPendingStep: true,
      },
      expect.objectContaining({
        id: 'run-1:step-1',
        delay: 5_000,
      }),
    );
    expect(output.pendingEvent).toBe(true);
    expect(output.waitMs).toBe(5_000);
    expect(output.pendingReason).toBe(LINKEDIN_RATE_LIMIT_PENDING_REASON);
    expect(output.scheduledAt).toEqual(expect.any(String));
  });

  it('includes the rate-limited method on the pending output', async () => {
    const delayedQueue = buildDelayedQueue();

    const output = await deferWorkflowForAccountRateLimit({
      delayedQueue: delayedQueue as never,
      waitMs: 300_000,
      currentStepId: 'step-1',
      workspaceId: 'ws-1',
      workflowRunId: 'run-1',
      method: 'connection_request',
    });

    expect(output.method).toBe('connection_request');
    expect(output.waitMs).toBe(300_000);
  });
});
