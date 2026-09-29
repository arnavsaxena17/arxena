import { OutreachSequencerSiblingRunCancelService } from 'src/engine/core-modules/outreach-command/services/outreach-sequencer-sibling-run-cancel.service';
import { WorkflowRunStatus } from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';
import { SEEDED_OUTREACH_WORKFLOW } from 'src/engine/workspace-manager/standard-objects-prefill-data/constants/seeded-outreach-workflow-names.const';

const WORKSPACE_ID = 'workspace-1';
const CURRENT_RUN_ID = 'run-new';
const CANDIDATE_ID = 'candidate-1';
const WORKFLOW_ID = 'workflow-sequencer';

describe('OutreachSequencerSiblingRunCancelService', () => {
  const endWorkflowRun = jest.fn();
  const getWorkflowRunOrFail = jest.fn();
  const removeJob = jest.fn();
  const getInFlightJobs = jest.fn().mockResolvedValue([]);
  const workflowFindOne = jest.fn();
  const workflowRunFind = jest.fn();

  const globalWorkspaceOrmManager = {
    executeInWorkspaceContext: jest.fn(
      async (callback: () => Promise<unknown>) => callback(),
    ),
    getRepository: jest.fn(async (_workspaceId: string, objectName: string) => {
      if (objectName === 'workflow') {
        return { findOne: workflowFindOne };
      }

      if (objectName === 'workflowRun') {
        return { find: workflowRunFind };
      }

      throw new Error(`Unexpected repository ${objectName}`);
    }),
  };

  const workflowRunWorkspaceService = {
    getWorkflowRunOrFail,
    endWorkflowRun,
  };

  const delayedQueue = {
    getInFlightJobs,
    removeJob,
  };

  const buildService = () =>
    new OutreachSequencerSiblingRunCancelService(
      globalWorkspaceOrmManager as never,
      workflowRunWorkspaceService as never,
      delayedQueue as never,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    workflowFindOne.mockResolvedValue({
      id: WORKFLOW_ID,
      name: SEEDED_OUTREACH_WORKFLOW.candidateSequencer.name,
    });
    getWorkflowRunOrFail.mockResolvedValue({
      id: CURRENT_RUN_ID,
      candidateId: CANDIDATE_ID,
      workflowId: WORKFLOW_ID,
      createdAt: '2026-09-24T05:00:00.000Z',
      state: {
        stepInfos: {
          trigger: {
            result: {
              properties: { after: { outreachSequenceStage: 'REPLIED' } },
            },
          },
        },
      },
    });
  });

  it('stops older open sibling sequencer runs on REPLIED entry', async () => {
    workflowRunFind.mockResolvedValue([
      {
        id: 'run-old',
        createdAt: '2026-09-24T04:00:00.000Z',
        status: WorkflowRunStatus.RUNNING,
      },
      {
        id: 'run-same-time',
        createdAt: '2026-09-24T05:00:00.000Z',
        status: WorkflowRunStatus.ENQUEUED,
      },
    ]);

    const result =
      await buildService().cancelOlderSiblingRunsForNewSequencerRun({
        workspaceId: WORKSPACE_ID,
        workflowRunId: CURRENT_RUN_ID,
      });

    expect(result.stoppedRunIds).toEqual(['run-old']);
    expect(endWorkflowRun).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      workflowRunId: 'run-old',
      status: WorkflowRunStatus.STOPPED,
      error: expect.stringContaining(CURRENT_RUN_ID),
    });
  });

  it('no-ops for non-sequencer workflows', async () => {
    workflowFindOne.mockResolvedValue({
      id: WORKFLOW_ID,
      name: SEEDED_OUTREACH_WORKFLOW.harvest.name,
    });

    const result =
      await buildService().cancelOlderSiblingRunsForNewSequencerRun({
        workspaceId: WORKSPACE_ID,
        workflowRunId: CURRENT_RUN_ID,
      });

    expect(result.stoppedRunIds).toEqual([]);
    expect(workflowRunFind).not.toHaveBeenCalled();
    expect(endWorkflowRun).not.toHaveBeenCalled();
  });

  it('no-ops for QUEUED entry stage', async () => {
    getWorkflowRunOrFail.mockResolvedValue({
      id: CURRENT_RUN_ID,
      candidateId: CANDIDATE_ID,
      workflowId: WORKFLOW_ID,
      createdAt: '2026-09-24T05:00:00.000Z',
      state: {
        stepInfos: {
          trigger: {
            result: {
              properties: { after: { outreachSequenceStage: 'QUEUED' } },
            },
          },
        },
      },
    });

    const result =
      await buildService().cancelOlderSiblingRunsForNewSequencerRun({
        workspaceId: WORKSPACE_ID,
        workflowRunId: CURRENT_RUN_ID,
      });

    expect(result.stoppedRunIds).toEqual([]);
    expect(endWorkflowRun).not.toHaveBeenCalled();
  });
});
