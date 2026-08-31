import { RESUME_DELAYED_WORKFLOW_JOB_NAME } from 'src/modules/workflow/workflow-executor/workflow-actions/delay/contants/resume-delayed-workflow-job-name';
import {
  buildResumeDelayedWorkflowJobOptions,
  cancelResumeDelayedWorkflowJobs,
  scheduleResumeDelayedWorkflowJob,
} from 'src/modules/workflow/workflow-executor/workflow-actions/delay/utils/resume-delayed-workflow-job-scheduler.util';

describe('resume-delayed-workflow-job-scheduler', () => {
  const buildDelayedQueue = () => ({
    getInFlightJobs: jest.fn().mockResolvedValue([]),
    removeJob: jest.fn().mockResolvedValue(undefined),
    add: jest.fn().mockResolvedValue(undefined),
  });

  it('builds stable per-step job options', () => {
    expect(
      buildResumeDelayedWorkflowJobOptions({
        workflowRunId: 'run-1',
        stepId: 'step-1',
        delay: 5_000,
      }),
    ).toEqual({
      id: 'run-1__step-1',
      allowDuplicatedPrefixes: true,
      delay: 5_000,
    });
  });

  it('removes matching delayed jobs for a workflow run step', async () => {
    const delayedQueue = buildDelayedQueue();

    delayedQueue.getInFlightJobs.mockResolvedValue([
      {
        id: 'run-1:step-1-uuid',
        data: {
          workspaceId: 'ws-1',
          workflowRunId: 'run-1',
          stepId: 'step-1',
        },
      },
      {
        id: 'run-1:step-2-uuid',
        data: {
          workspaceId: 'ws-1',
          workflowRunId: 'run-1',
          stepId: 'step-2',
        },
      },
      {
        id: 'run-2:step-1-uuid',
        data: {
          workspaceId: 'ws-1',
          workflowRunId: 'run-2',
          stepId: 'step-1',
        },
      },
    ]);

    const removed = await cancelResumeDelayedWorkflowJobs({
      delayedQueue: delayedQueue as never,
      workflowRunId: 'run-1',
      stepId: 'step-1',
    });

    expect(removed).toBe(1);
    expect(delayedQueue.removeJob).toHaveBeenCalledWith('run-1:step-1-uuid');
  });

  it('replaces an existing delayed job before scheduling a new one', async () => {
    const delayedQueue = buildDelayedQueue();

    delayedQueue.getInFlightJobs.mockResolvedValue([
      {
        id: 'run-1:step-1-old',
        data: {
          workspaceId: 'ws-1',
          workflowRunId: 'run-1',
          stepId: 'step-1',
        },
      },
    ]);

    await scheduleResumeDelayedWorkflowJob({
      delayedQueue: delayedQueue as never,
      data: {
        workspaceId: 'ws-1',
        workflowRunId: 'run-1',
        stepId: 'step-1',
        retryPendingStep: true,
      },
      delay: 0,
    });

    expect(delayedQueue.removeJob).toHaveBeenCalledWith('run-1:step-1-old');
    expect(delayedQueue.add).toHaveBeenCalledWith(
      RESUME_DELAYED_WORKFLOW_JOB_NAME,
      {
        workspaceId: 'ws-1',
        workflowRunId: 'run-1',
        stepId: 'step-1',
        retryPendingStep: true,
      },
      expect.objectContaining({
        id: 'run-1__step-1',
        delay: 0,
      }),
    );
  });
});
