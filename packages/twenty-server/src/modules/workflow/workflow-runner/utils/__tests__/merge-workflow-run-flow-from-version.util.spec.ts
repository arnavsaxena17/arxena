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

  it('preserves each duplicate-named step by id instead of collapsing by name', () => {
    const queuedLoadId = 'bf5db0df-c7ec-4392-8c41-0845300ba790';
    const acceptLoadId = '0191a76e-bf48-417c-b2e2-7ce97e49edf3';
    const repliedLoadId = '2ce89d31-aaaa-4fcb-a7d8-17a7736ed045';
    const sendId = 'c7a1000a-aaaa-4fcb-a7d8-17a7736ed045';

    const buildFindStep = (id: string): WorkflowAction =>
      ({
        id,
        name: 'Load Candidate',
        type: WorkflowActionType.FIND_RECORDS,
        valid: true,
        settings: {
          input: {
            objectName: 'candidate',
            limit: 1,
          },
        },
        nextStepIds: id === queuedLoadId ? [sendId] : [],
      }) as WorkflowAction;

    const steps = [
      buildFindStep(queuedLoadId),
      buildFindStep(acceptLoadId),
      buildFindStep(repliedLoadId),
      buildSendStep({
        id: sendId,
        name: 'Send LinkedIn connection (no company)',
        body: 'Connect',
      }),
    ];

    const currentState: WorkflowRunState = {
      flow: {
        trigger: { type: 'MANUAL', nextStepIds: [queuedLoadId] } as never,
        steps,
      },
      stepInfos: {
        trigger: { status: StepStatus.SUCCESS, result: {} },
        [queuedLoadId]: {
          status: StepStatus.SUCCESS,
          result: {
            first: {
              id: 'candidate-1',
              linkedinProfileId: 'ACoAAA',
            },
          },
        },
        [acceptLoadId]: { status: StepStatus.SKIPPED },
        [repliedLoadId]: { status: StepStatus.SKIPPED },
        [sendId]: { status: StepStatus.PENDING, pendingReason: 'rate_limit' },
      },
    };

    const result = mergeWorkflowRunFlowFromVersion({
      currentState,
      nextTrigger: { type: 'MANUAL', nextStepIds: [queuedLoadId] } as never,
      nextSteps: steps,
    });

    expect(result.state.stepInfos[queuedLoadId]).toEqual({
      status: StepStatus.SUCCESS,
      result: {
        first: {
          id: 'candidate-1',
          linkedinProfileId: 'ACoAAA',
        },
      },
    });
    expect(result.state.stepInfos[acceptLoadId]?.status).toBe(
      StepStatus.SKIPPED,
    );
    expect(result.state.stepInfos[repliedLoadId]?.status).toBe(
      StepStatus.SKIPPED,
    );
    expect(result.state.stepInfos[sendId]?.status).toBe(StepStatus.PENDING);
  });

  it('does not reopen approve when the LinkedIn send already succeeded', () => {
    const oldApproveId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const newApproveId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const oldSendId = '33333333-3333-4333-8333-333333333333';
    const newSendId = '44444444-4444-4444-8444-444444444444';
    const oldWaitId = '55555555-5555-4555-8555-555555555555';
    const newWaitId = '66666666-6666-4666-8666-666666666666';

    const buildFormStep = ({
      id,
      body,
      nextStepIds,
    }: {
      id: string;
      body: string;
      nextStepIds: string[];
    }): WorkflowAction =>
      ({
        id,
        name: 'Approve / edit first message',
        type: WorkflowActionType.FORM,
        valid: true,
        settings: {
          input: [{ name: 'editedBody', type: 'TEXT', value: body }],
        },
        nextStepIds,
      }) as WorkflowAction;

    const currentState: WorkflowRunState = {
      flow: {
        trigger: { type: 'MANUAL', nextStepIds: [oldApproveId] } as never,
        steps: [
          buildFormStep({
            id: oldApproveId,
            body: 'Old draft',
            nextStepIds: [oldSendId],
          }),
          buildSendStep({
            id: oldSendId,
            name: 'Send LinkedIn message',
            body: 'Old body',
          }),
          {
            id: oldWaitId,
            name: 'Wait 2-5 days before follow-up',
            type: WorkflowActionType.DELAY,
            valid: true,
            settings: { input: { days: 3 } },
            nextStepIds: [],
          } as WorkflowAction,
        ],
      },
      stepInfos: {
        trigger: { status: StepStatus.SUCCESS, result: {} },
        [oldApproveId]: {
          status: StepStatus.SUCCESS,
          result: { editedBody: 'Approved copy' },
        },
        [oldSendId]: {
          status: StepStatus.SUCCESS,
          result: { sent: true },
        },
        [oldWaitId]: {
          status: StepStatus.PENDING,
          pendingReason: 'outreach_sequence_delay',
          remainingMs: 86_400_000,
        },
      },
    };

    const result = mergeWorkflowRunFlowFromVersion({
      currentState,
      nextTrigger: { type: 'MANUAL', nextStepIds: [newApproveId] } as never,
      nextSteps: [
        buildFormStep({
          id: newApproveId,
          body: 'New draft template',
          nextStepIds: [newSendId],
        }),
        buildSendStep({
          id: newSendId,
          name: 'Send LinkedIn message',
          body: 'New body',
        }),
        {
          id: newWaitId,
          name: 'Wait 2-5 days before follow-up',
          type: WorkflowActionType.DELAY,
          valid: true,
          settings: { input: { days: 3 } },
          nextStepIds: [],
        } as WorkflowAction,
      ],
    });

    expect(result.resetStepIds).toEqual([]);
    expect(result.state.stepInfos[newApproveId]?.status).toBe(
      StepStatus.SUCCESS,
    );
    expect(result.state.stepInfos[newSendId]?.status).toBe(StepStatus.SUCCESS);
    expect(result.state.stepInfos[newWaitId]?.status).toBe(StepStatus.PENDING);
  });
});
