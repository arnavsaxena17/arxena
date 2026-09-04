import { StepStatus, WorkflowActionType } from 'twenty-shared/workflow';

import { planStaleFormAfterSendRepairs } from 'src/engine/core-modules/outreach-command/utils/plan-stale-form-after-send-repairs.util';
import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

const buildFormStep = ({
  id,
  nextStepIds,
}: {
  id: string;
  nextStepIds: string[];
}): WorkflowAction =>
  ({
    id,
    name: 'Approve / edit first message',
    type: WorkflowActionType.FORM,
    valid: true,
    settings: { input: [] },
    nextStepIds,
  }) as WorkflowAction;

const buildSendStep = ({
  id,
  nextStepIds,
}: {
  id: string;
  nextStepIds?: string[];
}): WorkflowAction =>
  ({
    id,
    name: 'Send LinkedIn message',
    type: WorkflowActionType.SEND_LINKEDIN_MESSAGE,
    valid: true,
    settings: { input: {} },
    nextStepIds,
  }) as WorkflowAction;

describe('planStaleFormAfterSendRepairs', () => {
  it('plans repair when approve is pending after send succeeded', () => {
    const formStepId = 'form-1';
    const sendStepId = 'send-1';
    const waitStepId = 'wait-1';

    const plans = planStaleFormAfterSendRepairs({
      flow: {
        steps: [
          buildFormStep({ id: formStepId, nextStepIds: [sendStepId] }),
          buildSendStep({ id: sendStepId, nextStepIds: [waitStepId] }),
          {
            id: waitStepId,
            name: 'Wait 2-5 days before follow-up',
            type: WorkflowActionType.DELAY,
            valid: true,
            settings: { input: { days: 3 } },
            nextStepIds: [],
          } as WorkflowAction,
        ],
      },
      stepInfos: {
        [formStepId]: {
          status: StepStatus.PENDING,
          pendingReason: 'outreach_project_paused',
        },
        [sendStepId]: {
          status: StepStatus.SUCCESS,
          result: { sent: true },
        },
        [waitStepId]: {
          status: StepStatus.PENDING,
          pendingReason: 'outreach_sequence_delay',
          remainingMs: 86_400_000,
        },
      },
    });

    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({
      formStepId,
      sendStepId,
      continueFromSendStepId: null,
      repairedFormStepInfo: {
        status: StepStatus.SUCCESS,
        result: { repairedFromStalePending: true },
      },
    });
  });

  it('continues from send when the next step never started', () => {
    const formStepId = 'form-1';
    const sendStepId = 'send-1';
    const waitStepId = 'wait-1';

    const plans = planStaleFormAfterSendRepairs({
      flow: {
        steps: [
          buildFormStep({ id: formStepId, nextStepIds: [sendStepId] }),
          buildSendStep({ id: sendStepId, nextStepIds: [waitStepId] }),
          {
            id: waitStepId,
            name: 'Wait 2-5 days before follow-up',
            type: WorkflowActionType.DELAY,
            valid: true,
            settings: { input: { days: 3 } },
            nextStepIds: [],
          } as WorkflowAction,
        ],
      },
      stepInfos: {
        [formStepId]: { status: StepStatus.PENDING },
        [sendStepId]: { status: StepStatus.SUCCESS, result: { sent: true } },
        [waitStepId]: { status: StepStatus.NOT_STARTED },
      },
    });

    expect(plans[0]?.continueFromSendStepId).toBe(sendStepId);
  });

  it('does not plan repair for a healthy pending approve', () => {
    const formStepId = 'form-1';
    const sendStepId = 'send-1';

    expect(
      planStaleFormAfterSendRepairs({
        flow: {
          steps: [
            buildFormStep({ id: formStepId, nextStepIds: [sendStepId] }),
            buildSendStep({ id: sendStepId }),
          ],
        },
        stepInfos: {
          [formStepId]: { status: StepStatus.PENDING },
          [sendStepId]: { status: StepStatus.NOT_STARTED },
        },
      }),
    ).toEqual([]);
  });
});
