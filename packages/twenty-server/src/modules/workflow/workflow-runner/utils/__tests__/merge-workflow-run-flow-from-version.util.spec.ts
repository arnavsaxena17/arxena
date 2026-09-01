import { StepStatus, WorkflowActionType } from 'twenty-shared/workflow';

import { type WorkflowRunState } from 'src/modules/workflow/common/standard-objects/workflow-run.workspace-entity';
import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';
import { mergeWorkflowRunFlowFromVersion } from 'src/modules/workflow/workflow-runner/utils/merge-workflow-run-flow-from-version.util';

const buildAiStep = ({
  id,
  name,
  prompt,
  nextStepIds,
}: {
  id: string;
  name: string;
  prompt: string;
  nextStepIds?: string[];
}): WorkflowAction =>
  ({
    id,
    name,
    type: WorkflowActionType.AI_AGENT,
    valid: true,
    settings: {
      input: {
        prompt,
        agentId: 'agent-1',
      },
    },
    nextStepIds,
  }) as WorkflowAction;

const buildSendStep = ({
  id,
  name,
  body,
}: {
  id: string;
  name: string;
  body: string;
}): WorkflowAction =>
  ({
    id,
    name,
    type: WorkflowActionType.SEND_LINKEDIN_MESSAGE,
    valid: true,
    settings: {
      input: {
        body,
        workspaceMemberId: '{{trigger.workspaceMemberId}}',
        linkedinProfileId: '{{trigger.linkedinProfileId}}',
      },
    },
  }) as WorkflowAction;

describe('mergeWorkflowRunFlowFromVersion', () => {
  it('replaces not-started steps with the latest version definitions', () => {
    const oldDraftId = '11111111-1111-4111-8111-111111111111';
    const newDraftId = '22222222-2222-4222-8222-222222222222';
    const oldSendId = '33333333-3333-4333-8333-333333333333';
    const newSendId = '44444444-4444-4444-8444-444444444444';

    const currentState: WorkflowRunState = {
      flow: {
        trigger: { type: 'MANUAL', nextStepIds: [oldDraftId] } as never,
        steps: [
          buildAiStep({
            id: oldDraftId,
            name: 'Draft LinkedIn opener',
            prompt: 'Old prompt',
            nextStepIds: [oldSendId],
          }),
          buildSendStep({
            id: oldSendId,
            name: 'Send opener',
            body: 'Old body',
          }),
        ],
      },
      stepInfos: {
        trigger: { status: StepStatus.SUCCESS, result: {} },
        [oldDraftId]: { status: StepStatus.NOT_STARTED },
        [oldSendId]: { status: StepStatus.NOT_STARTED },
      },
    };

    const result = mergeWorkflowRunFlowFromVersion({
      currentState,
      nextTrigger: { type: 'MANUAL', nextStepIds: [newDraftId] } as never,
      nextSteps: [
        buildAiStep({
          id: newDraftId,
          name: 'Draft LinkedIn opener',
          prompt: 'New prompt',
          nextStepIds: [newSendId],
        }),
        buildSendStep({
          id: newSendId,
          name: 'Send opener',
          body: 'New body',
        }),
      ],
    });

    expect(result.state.flow.steps).toHaveLength(2);
    expect(result.state.flow.steps[0].settings.input.prompt).toBe('New prompt');
    expect(result.state.flow.steps[1].settings.input.body).toBe('New body');
    expect(result.state.stepInfos[newDraftId]?.status).toBe(
      StepStatus.NOT_STARTED,
    );
    expect(result.state.stepInfos[newSendId]?.status).toBe(
      StepStatus.NOT_STARTED,
    );
    expect(result.resetStepIds).toEqual([]);
  });

  it('resets a completed draft and downstream steps when the prompt changed', () => {
    const oldDraftId = '11111111-1111-4111-8111-111111111111';
    const newDraftId = '22222222-2222-4222-8222-222222222222';
    const oldSendId = '33333333-3333-4333-8333-333333333333';
    const newSendId = '44444444-4444-4444-8444-444444444444';

    const currentState: WorkflowRunState = {
      flow: {
        trigger: { type: 'MANUAL', nextStepIds: [oldDraftId] } as never,
        steps: [
          buildAiStep({
            id: oldDraftId,
            name: 'Draft LinkedIn opener',
            prompt: 'Old prompt',
            nextStepIds: [oldSendId],
          }),
          buildSendStep({
            id: oldSendId,
            name: 'Send opener',
            body: 'Old body',
          }),
        ],
      },
      stepInfos: {
        trigger: { status: StepStatus.SUCCESS, result: {} },
        [oldDraftId]: {
          status: StepStatus.SUCCESS,
          result: { message: 'Already drafted' },
        },
        [oldSendId]: { status: StepStatus.NOT_STARTED },
      },
    };

    const result = mergeWorkflowRunFlowFromVersion({
      currentState,
      nextTrigger: { type: 'MANUAL', nextStepIds: [newDraftId] } as never,
      nextSteps: [
        buildAiStep({
          id: newDraftId,
          name: 'Draft LinkedIn opener',
          prompt: 'New prompt',
          nextStepIds: [newSendId],
        }),
        buildSendStep({
          id: newSendId,
          name: 'Send opener',
          body: 'New body',
        }),
      ],
    });

    expect(result.resetStepIds).toEqual([newDraftId, newSendId]);
    expect(result.state.stepInfos[newDraftId]).toEqual({
      status: StepStatus.NOT_STARTED,
    });
    expect(result.state.stepInfos[newSendId]).toEqual({
      status: StepStatus.NOT_STARTED,
    });
  });

  it('preserves pending delay timing when step ids change', () => {
    const oldDelayId = '55555555-5555-4555-8555-555555555555';
    const newDelayId = '66666666-6666-4666-8666-666666666666';

    const currentState: WorkflowRunState = {
      flow: {
        trigger: { type: 'MANUAL', nextStepIds: [oldDelayId] } as never,
        steps: [
          {
            id: oldDelayId,
            name: 'Wait before follow-up 2',
            type: WorkflowActionType.DELAY,
            valid: true,
            settings: { input: { days: 3 } },
          } as WorkflowAction,
        ],
      },
      stepInfos: {
        trigger: { status: StepStatus.SUCCESS, result: {} },
        [oldDelayId]: {
          status: StepStatus.PENDING,
          pendingReason: 'outreach_project_paused',
          remainingMs: 120000,
          waitMs: 120000,
        },
      },
    };

    const result = mergeWorkflowRunFlowFromVersion({
      currentState,
      nextTrigger: { type: 'MANUAL', nextStepIds: [newDelayId] } as never,
      nextSteps: [
        {
          id: newDelayId,
          name: 'Wait before follow-up 2',
          type: WorkflowActionType.DELAY,
          valid: true,
          settings: { input: { days: 3 } },
        } as WorkflowAction,
      ],
    });

    expect(result.state.stepInfos[newDelayId]).toEqual({
      status: StepStatus.PENDING,
      pendingReason: 'outreach_project_paused',
      remainingMs: 120000,
      waitMs: 120000,
    });
  });

  it('updates pending send steps without resetting already sent messages', () => {
    const oldSendId = '33333333-3333-4333-8333-333333333333';
    const newSendId = '44444444-4444-4444-8444-444444444444';

    const currentState: WorkflowRunState = {
      flow: {
        trigger: { type: 'MANUAL', nextStepIds: [oldSendId] } as never,
        steps: [
          buildSendStep({
            id: oldSendId,
            name: 'Send opener',
            body: 'Old body',
          }),
        ],
      },
      stepInfos: {
        trigger: { status: StepStatus.SUCCESS, result: {} },
        [oldSendId]: {
          status: StepStatus.SUCCESS,
          result: { sent: true },
        },
      },
    };

    const result = mergeWorkflowRunFlowFromVersion({
      currentState,
      nextTrigger: { type: 'MANUAL', nextStepIds: [newSendId] } as never,
      nextSteps: [
        buildSendStep({
          id: newSendId,
          name: 'Send opener',
          body: 'New body',
        }),
      ],
    });

    expect(result.resetStepIds).toEqual([]);
    expect(result.state.stepInfos[newSendId]).toEqual({
      status: StepStatus.SUCCESS,
      result: { sent: true },
    });
    expect(result.state.flow.steps[0].settings.input.body).toBe('New body');
  });
});
