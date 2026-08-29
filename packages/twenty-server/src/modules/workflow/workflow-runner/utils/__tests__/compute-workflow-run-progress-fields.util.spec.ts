import { StepStatus, WorkflowActionType } from 'twenty-shared/workflow';

import {
  WorkflowRunCurrentStepKind,
  WorkflowRunStatus,
} from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';

import { computeWorkflowRunProgressFields } from '../compute-workflow-run-progress-fields.util';

const buildState = ({
  steps,
  stepInfos,
}: {
  steps: Array<{ id: string; name: string; type: string }>;
  stepInfos: Record<string, { status: StepStatus; pendingReason?: string; scheduledAt?: string; result?: object }>;
}) => ({
  flow: {
    trigger: { type: 'MANUAL', settings: {} },
    steps,
  },
  stepInfos: {
    trigger: { status: StepStatus.SUCCESS },
    ...stepInfos,
  },
});

describe('computeWorkflowRunProgressFields', () => {
  it('clears progress on terminal runs', () => {
    const state = buildState({
      steps: [
        {
          id: 'send',
          name: 'Send LinkedIn connection',
          type: WorkflowActionType.SEND_LINKEDIN_CONNECTION_REQUEST,
        },
      ],
      stepInfos: {
        send: {
          status: StepStatus.PENDING,
          pendingReason: 'linkedin_rate_limit',
          scheduledAt: '2026-08-29T13:41:00.000Z',
        },
      },
    });

    expect(
      computeWorkflowRunProgressFields({
        state: state as never,
        status: WorkflowRunStatus.STOPPED,
      }),
    ).toEqual({
      currentStepName: null,
      currentStepKind: null,
      resumeAt: null,
      upcomingSteps: null,
    });
  });

  it('marks LinkedIn rate-limited pending steps', () => {
    const state = buildState({
      steps: [
        {
          id: 'load',
          name: 'Load workspace member',
          type: WorkflowActionType.FIND_RECORDS,
        },
        {
          id: 'send',
          name: 'Send LinkedIn connection',
          type: WorkflowActionType.SEND_LINKEDIN_CONNECTION_REQUEST,
        },
        {
          id: 'mark',
          name: 'Mark CONNECTION_SENT',
          type: WorkflowActionType.UPDATE_RECORD,
        },
      ],
      stepInfos: {
        load: { status: StepStatus.SUCCESS },
        send: {
          status: StepStatus.PENDING,
          result: {
            pendingReason: 'linkedin_rate_limit',
            scheduledAt: '2026-08-29T13:41:00.000Z',
          },
        },
        mark: { status: StepStatus.NOT_STARTED },
      },
    });

    expect(
      computeWorkflowRunProgressFields({
        state: state as never,
        status: WorkflowRunStatus.RUNNING,
      }),
    ).toEqual({
      currentStepName: 'Send LinkedIn connection',
      currentStepKind: WorkflowRunCurrentStepKind.RATE_LIMITED,
      resumeAt: '2026-08-29T13:41:00.000Z',
      upcomingSteps: 'Mark CONNECTION_SENT',
    });
  });

  it('marks delay and form pending steps', () => {
    expect(
      computeWorkflowRunProgressFields({
        state: buildState({
          steps: [
            {
              id: 'delay',
              name: 'Wait 3 days',
              type: WorkflowActionType.DELAY,
            },
          ],
          stepInfos: { delay: { status: StepStatus.PENDING } },
        }) as never,
        status: WorkflowRunStatus.RUNNING,
      }).currentStepKind,
    ).toBe(WorkflowRunCurrentStepKind.DELAY);

    expect(
      computeWorkflowRunProgressFields({
        state: buildState({
          steps: [
            {
              id: 'form',
              name: 'Review opener',
              type: WorkflowActionType.FORM,
            },
          ],
          stepInfos: { form: { status: StepStatus.PENDING } },
        }) as never,
        status: WorkflowRunStatus.RUNNING,
      }).currentStepKind,
    ).toBe(WorkflowRunCurrentStepKind.FORM);
  });

  it('marks executing steps and lists remaining nodes', () => {
    expect(
      computeWorkflowRunProgressFields({
        state: buildState({
          steps: [
            {
              id: 'load',
              name: 'Load Candidate',
              type: WorkflowActionType.FIND_RECORDS,
            },
            {
              id: 'send',
              name: 'Send LinkedIn connection',
              type: WorkflowActionType.SEND_LINKEDIN_CONNECTION_REQUEST,
            },
          ],
          stepInfos: {
            load: { status: StepStatus.RUNNING },
            send: { status: StepStatus.NOT_STARTED },
          },
        }) as never,
        status: WorkflowRunStatus.RUNNING,
      }),
    ).toEqual({
      currentStepName: 'Load Candidate',
      currentStepKind: WorkflowRunCurrentStepKind.EXECUTING,
      resumeAt: null,
      upcomingSteps: 'Send LinkedIn connection',
    });
  });
});
