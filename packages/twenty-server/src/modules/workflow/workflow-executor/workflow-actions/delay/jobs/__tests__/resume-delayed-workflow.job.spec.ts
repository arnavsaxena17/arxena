import { StepStatus } from 'twenty-shared/workflow';

import { WorkflowRunStatus } from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';
import { ResumeDelayedWorkflowJob } from 'src/modules/workflow/workflow-executor/workflow-actions/delay/jobs/resume-delayed-workflow.job';
import { RUN_WORKFLOW_JOB_NAME } from 'src/modules/workflow/workflow-runner/constants/run-workflow-job-name';

describe('ResumeDelayedWorkflowJob', () => {
  const workspaceId = 'workspace-1';
  const workflowRunId = 'run-1';
  const stepId = 'step-1';

  const buildJob = () => {
    const messageQueueService = { add: jest.fn().mockResolvedValue(undefined) };
    const workflowRunWorkspaceService = {
      getWorkflowRunOrFail: jest.fn().mockResolvedValue({
        status: WorkflowRunStatus.RUNNING,
        state: {
          flow: { steps: [{ id: stepId }] },
          stepInfos: { [stepId]: { status: StepStatus.PENDING } },
        },
      }),
      updateWorkflowRunStepInfo: jest.fn().mockResolvedValue(undefined),
      endWorkflowRun: jest.fn().mockResolvedValue(undefined),
    };
    const globalWorkspaceOrmManager = {
      executeInWorkspaceContext: jest.fn(
        async (callback: () => Promise<void>) => callback(),
      ),
    };

    const job = new ResumeDelayedWorkflowJob(
      messageQueueService as never,
      workflowRunWorkspaceService as never,
      globalWorkspaceOrmManager as never,
    );

    return { job, messageQueueService, workflowRunWorkspaceService };
  };

  it('re-executes a rate-limited logic function instead of marking it successful', async () => {
    const { job, messageQueueService, workflowRunWorkspaceService } =
      buildJob();

    await job.handle({
      workspaceId,
      workflowRunId,
      stepId,
      retryPendingStep: true,
    });

    expect(
      workflowRunWorkspaceService.updateWorkflowRunStepInfo,
    ).toHaveBeenCalledWith({
      stepId,
      stepInfo: {
        status: StepStatus.NOT_STARTED,
        pendingReason: undefined,
        waitMs: undefined,
        scheduledAt: undefined,
        remainingMs: undefined,
        method: undefined,
      },
      workspaceId,
      workflowRunId,
    });

    expect(messageQueueService.add).toHaveBeenCalledWith(
      RUN_WORKFLOW_JOB_NAME,
      {
        workspaceId,
        workflowRunId,
        stepIdsToRetry: [stepId],
      },
      expect.objectContaining({ id: workflowRunId }),
    );
  });

  it('completes delay steps and continues the run', async () => {
    const { job, messageQueueService, workflowRunWorkspaceService } =
      buildJob();

    await job.handle({
      workspaceId,
      workflowRunId,
      stepId,
    });

    expect(
      workflowRunWorkspaceService.updateWorkflowRunStepInfo,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        stepInfo: {
          status: StepStatus.SUCCESS,
          result: { success: true },
        },
      }),
    );

    expect(messageQueueService.add).toHaveBeenCalledWith(
      RUN_WORKFLOW_JOB_NAME,
      expect.objectContaining({ lastExecutedStepId: stepId }),
      expect.any(Object),
    );
  });

  it('no-ops when a stale timer fires after the step already advanced', async () => {
    const { job, messageQueueService, workflowRunWorkspaceService } =
      buildJob();

    workflowRunWorkspaceService.getWorkflowRunOrFail.mockResolvedValue({
      status: WorkflowRunStatus.RUNNING,
      state: {
        flow: { steps: [{ id: stepId }] },
        stepInfos: { [stepId]: { status: StepStatus.SUCCESS } },
      },
    });

    await job.handle({
      workspaceId,
      workflowRunId,
      stepId,
    });

    expect(
      workflowRunWorkspaceService.updateWorkflowRunStepInfo,
    ).not.toHaveBeenCalled();
    expect(messageQueueService.add).not.toHaveBeenCalled();
    expect(workflowRunWorkspaceService.endWorkflowRun).not.toHaveBeenCalled();
  });
});
