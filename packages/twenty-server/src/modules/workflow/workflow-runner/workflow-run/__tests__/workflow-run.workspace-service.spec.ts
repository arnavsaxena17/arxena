import { Test } from '@nestjs/testing';
import { StepStatus } from 'twenty-shared/workflow';

import { MetricsService } from 'src/engine/core-modules/metrics/metrics.service';
import { OutreachCacheRealtimeService } from 'src/engine/core-modules/outreach-command/services/outreach-cache-realtime.service';
import { RecordPositionService } from 'src/engine/core-modules/record-position/services/record-position.service';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import {
  WorkflowRunStatus,
  type WorkflowRunWorkspaceEntity,
} from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';
import { WorkflowCommonWorkspaceService } from 'src/modules/workflow/common/workspace-services/workflow-common.workspace-service';
import {
  WorkflowRunException,
  WorkflowRunExceptionCode,
} from 'src/modules/workflow/workflow-runner/exceptions/workflow-run.exception';
import { WorkflowRunWorkspaceService } from 'src/modules/workflow/workflow-runner/workflow-run/workflow-run.workspace-service';

const WORKFLOW_RUN_ID = 'c580febf-a11a-4433-b27f-65305c84f76e';
const WORKSPACE_ID = '54a99d20-8be6-4869-8eeb-aa1aeadfb694';

const buildWorkflowRun = (
  overrides: Partial<WorkflowRunWorkspaceEntity> = {},
): WorkflowRunWorkspaceEntity =>
  ({
    id: WORKFLOW_RUN_ID,
    status: WorkflowRunStatus.RUNNING,
    stateVersion: 0,
    candidateId: null,
    state: {
      flow: {
        trigger: { type: 'DATABASE_EVENT', settings: {} },
        steps: [
          {
            id: 'step-a',
            name: 'Step A',
            type: 'CODE',
            valid: true,
            settings: {},
          },
          {
            id: 'step-b',
            name: 'Step B',
            type: 'CODE',
            valid: true,
            settings: {},
          },
        ],
      },
      stepInfos: {
        trigger: { status: StepStatus.SUCCESS },
        'step-a': { status: StepStatus.NOT_STARTED },
        'step-b': { status: StepStatus.NOT_STARTED },
      },
    },
    ...overrides,
  }) as WorkflowRunWorkspaceEntity;

describe('WorkflowRunWorkspaceService optimistic concurrency', () => {
  let service: WorkflowRunWorkspaceService;
  let findOneBy: jest.Mock;
  let update: jest.Mock;
  let notifyProjectCacheUpdated: jest.Mock;

  beforeEach(async () => {
    findOneBy = jest.fn();
    update = jest.fn().mockResolvedValue({ affected: 1 });
    notifyProjectCacheUpdated = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkflowRunWorkspaceService,
        {
          provide: GlobalWorkspaceOrmManager,
          useValue: {
            executeInWorkspaceContext: jest.fn(
              async (callback: () => Promise<unknown>) => callback(),
            ),
            getRepository: jest.fn().mockResolvedValue({
              findOneBy,
              findOne: findOneBy,
              update,
            }),
          },
        },
        {
          provide: WorkflowCommonWorkspaceService,
          useValue: {},
        },
        {
          provide: RecordPositionService,
          useValue: {},
        },
        {
          provide: MetricsService,
          useValue: {
            incrementCounterForEvent: jest.fn(),
          },
        },
        {
          provide: OutreachCacheRealtimeService,
          useValue: {
            notifyProjectCacheUpdated,
          },
        },
      ],
    }).compile();

    service = moduleRef.get(WorkflowRunWorkspaceService);
    jest
      .spyOn(
        service as unknown as { delay: (ms: number) => Promise<void> },
        'delay',
      )
      .mockResolvedValue(undefined);
  });

  it('retries on version conflict then merges both step updates', async () => {
    const baseRun = buildWorkflowRun({ stateVersion: 0 });
    const afterFirstWrite = buildWorkflowRun({
      stateVersion: 1,
      state: {
        ...baseRun.state,
        stepInfos: {
          ...baseRun.state.stepInfos,
          'step-a': { status: StepStatus.SUCCESS, result: { ok: true } },
        },
      },
    });

    findOneBy
      .mockResolvedValueOnce(baseRun)
      .mockResolvedValueOnce(afterFirstWrite);
    update
      .mockResolvedValueOnce({ affected: 0 })
      .mockResolvedValueOnce({ affected: 1 });

    await service.updateWorkflowRunStepInfo({
      workflowRunId: WORKFLOW_RUN_ID,
      workspaceId: WORKSPACE_ID,
      stepId: 'step-b',
      stepInfo: { status: StepStatus.SUCCESS, result: { done: true } },
    });

    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[0][0]).toEqual({
      id: WORKFLOW_RUN_ID,
      stateVersion: 0,
    });
    expect(update.mock.calls[1][0]).toEqual({
      id: WORKFLOW_RUN_ID,
      stateVersion: 1,
    });
    expect(update.mock.calls[1][1].state.stepInfos['step-a']).toEqual({
      status: StepStatus.SUCCESS,
      result: { ok: true },
    });
    expect(update.mock.calls[1][1].state.stepInfos['step-b']).toEqual({
      status: StepStatus.SUCCESS,
      result: { done: true },
    });
    expect(update.mock.calls[1][1].stateVersion).toBe(2);
  });

  it('no-ops step updates when the run is already FAILED', async () => {
    findOneBy.mockResolvedValue(
      buildWorkflowRun({
        status: WorkflowRunStatus.FAILED,
        stateVersion: 3,
      }),
    );

    await service.updateWorkflowRunStepInfo({
      workflowRunId: WORKFLOW_RUN_ID,
      workspaceId: WORKSPACE_ID,
      stepId: 'step-a',
      stepInfo: { status: StepStatus.SUCCESS },
    });

    expect(update).not.toHaveBeenCalled();
  });

  it('notifies outreach cache once after a successful write', async () => {
    findOneBy.mockResolvedValue(
      buildWorkflowRun({
        candidateId: 'candidate-1',
        stateVersion: 0,
      }),
    );
    update.mockResolvedValue({ affected: 1 });

    const getRepository = (
      service as unknown as {
        globalWorkspaceOrmManager: {
          getRepository: jest.Mock;
        };
      }
    ).globalWorkspaceOrmManager.getRepository;

    getRepository.mockImplementation(
      async (_workspaceId: string, objectName: string) => {
        if (objectName === 'candidate') {
          return {
            findOne: jest.fn().mockResolvedValue({ projectId: 'project-1' }),
          };
        }

        return {
          findOneBy,
          findOne: findOneBy,
          update,
        };
      },
    );

    await service.updateWorkflowRunStepInfo({
      workflowRunId: WORKFLOW_RUN_ID,
      workspaceId: WORKSPACE_ID,
      stepId: 'step-a',
      stepInfo: { status: StepStatus.RUNNING },
    });

    expect(notifyProjectCacheUpdated).toHaveBeenCalledTimes(1);
    expect(notifyProjectCacheUpdated).toHaveBeenCalledWith(
      'project-1',
      'journey',
    );
  });

  it('throws WORKFLOW_RUN_STATE_CONFLICT after exhausting retries', async () => {
    findOneBy.mockResolvedValue(buildWorkflowRun({ stateVersion: 0 }));
    update.mockResolvedValue({ affected: 0 });

    await expect(
      service.updateWorkflowRunStepInfo({
        workflowRunId: WORKFLOW_RUN_ID,
        workspaceId: WORKSPACE_ID,
        stepId: 'step-a',
        stepInfo: { status: StepStatus.SUCCESS },
      }),
    ).rejects.toMatchObject({
      code: WorkflowRunExceptionCode.WORKFLOW_RUN_STATE_CONFLICT,
    } satisfies Partial<WorkflowRunException>);
  });
});
