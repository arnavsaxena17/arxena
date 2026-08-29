import { StepStatus } from 'twenty-shared/workflow';

import { UploadProfilesWorkflowResumeService } from '../upload-profiles-workflow-resume.service';
import { WorkflowRunStatus } from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';
import { RunWorkflowJob } from 'src/modules/workflow/workflow-runner/jobs/run-workflow.job';

describe('UploadProfilesWorkflowResumeService', () => {
  const cache = {
    setAdd: jest.fn(),
    getSetLength: jest.fn(),
    setMembers: jest.fn(),
    setIfAbsent: jest.fn(),
    del: jest.fn(),
  };
  const workflowRunWorkspaceService = {
    updateWorkflowRunStepInfo: jest.fn(),
    endWorkflowRun: jest.fn(),
  };
  const workflowQueue = {
    add: jest.fn(),
  };

  const service = new UploadProfilesWorkflowResumeService(
    cache as never,
    workflowRunWorkspaceService as never,
    workflowQueue as never,
  );

  const correlation = {
    workflowRunId: 'run-1',
    workflowStepId: 'step-1',
    workspaceId: 'ws-1',
    projectId: 'project-1',
    uploadSessionId: 'session-1',
    totalBatches: 2,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not resume until all batches complete', async () => {
    cache.getSetLength.mockResolvedValue(1);

    await service.recordBatchSuccess({
      correlation,
      candidateIds: ['c1'],
      batchNumber: 1,
    });

    expect(cache.setAdd).toHaveBeenCalledWith(
      'upload-wf:session-1:ids',
      ['c1'],
      expect.any(Number),
    );
    expect(workflowRunWorkspaceService.updateWorkflowRunStepInfo).not.toHaveBeenCalled();
    expect(workflowQueue.add).not.toHaveBeenCalled();
  });

  it('marks step success and resumes workflow on last batch', async () => {
    cache.getSetLength.mockResolvedValue(2);
    cache.setIfAbsent.mockResolvedValue(true);
    cache.setMembers.mockResolvedValue(['c1', 'c2']);

    await service.recordBatchSuccess({
      correlation,
      candidateIds: ['c2'],
      batchNumber: 2,
    });

    expect(
      workflowRunWorkspaceService.updateWorkflowRunStepInfo,
    ).toHaveBeenCalledWith({
      stepId: 'step-1',
      stepInfo: {
        status: StepStatus.SUCCESS,
        result: {
          success: true,
          queued: 2,
          created: 2,
          candidateIds: ['c1', 'c2'],
          projectId: 'project-1',
          uploadSessionId: 'session-1',
          error: '',
        },
      },
      workspaceId: 'ws-1',
      workflowRunId: 'run-1',
    });

    expect(workflowQueue.add).toHaveBeenCalledWith(
      RunWorkflowJob.name,
      {
        workspaceId: 'ws-1',
        workflowRunId: 'run-1',
        lastExecutedStepId: 'step-1',
      },
      expect.objectContaining({ id: 'run-1' }),
    );
  });

  it('ignores non-terminal batch failures', async () => {
    await service.recordBatchFailure({
      correlation,
      errorMessage: 'transient',
      isTerminalAttempt: false,
    });

    expect(cache.setIfAbsent).not.toHaveBeenCalled();
    expect(workflowRunWorkspaceService.endWorkflowRun).not.toHaveBeenCalled();
  });

  it('fails the workflow step on terminal batch failure', async () => {
    cache.setIfAbsent.mockResolvedValue(true);

    await service.recordBatchFailure({
      correlation,
      errorMessage: 'hard failure',
      isTerminalAttempt: true,
    });

    expect(
      workflowRunWorkspaceService.updateWorkflowRunStepInfo,
    ).toHaveBeenCalledWith({
      stepId: 'step-1',
      stepInfo: {
        status: StepStatus.FAILED,
        error: 'hard failure',
      },
      workspaceId: 'ws-1',
      workflowRunId: 'run-1',
    });

    expect(workflowRunWorkspaceService.endWorkflowRun).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      workflowRunId: 'run-1',
      status: WorkflowRunStatus.FAILED,
      error: 'hard failure',
    });
  });
});
