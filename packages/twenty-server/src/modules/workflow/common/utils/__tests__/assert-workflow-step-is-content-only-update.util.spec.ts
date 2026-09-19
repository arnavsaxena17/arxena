import { WorkflowActionType } from 'twenty-shared/workflow';

import { assertWorkflowStepIsContentOnlyUpdate } from 'src/modules/workflow/common/utils/assert-workflow-step-is-content-only-update.util';
import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

const buildCodeStep = (
  overrides: Partial<WorkflowAction> = {},
): WorkflowAction =>
  ({
    id: 'step-1',
    name: 'Code',
    type: WorkflowActionType.CODE,
    valid: true,
    nextStepIds: ['step-2'],
    settings: {
      input: {
        logicFunctionId: 'fn-1',
        logicFunctionInput: { prompt: 'hello' },
      },
      outputSchema: {},
      errorHandlingOptions: {
        retryOnFailure: { value: false },
        continueOnFailure: { value: false },
      },
    },
    ...overrides,
  }) as WorkflowAction;

describe('assertWorkflowStepIsContentOnlyUpdate', () => {
  it('allows content-only settings changes', () => {
    expect(() =>
      assertWorkflowStepIsContentOnlyUpdate({
        existingStep: buildCodeStep(),
        updatedStep: buildCodeStep({
          name: 'Renamed',
          settings: {
            input: {
              logicFunctionId: 'fn-1',
              logicFunctionInput: { prompt: 'updated' },
            },
            outputSchema: {},
            errorHandlingOptions: {
              retryOnFailure: { value: false },
              continueOnFailure: { value: false },
            },
          },
        } as Partial<WorkflowAction>),
      }),
    ).not.toThrow();
  });

  it('rejects nextStepIds changes', () => {
    expect(() =>
      assertWorkflowStepIsContentOnlyUpdate({
        existingStep: buildCodeStep(),
        updatedStep: buildCodeStep({ nextStepIds: ['step-3'] }),
      }),
    ).toThrow('Changing step edges');
  });

  it('rejects type changes', () => {
    expect(() =>
      assertWorkflowStepIsContentOnlyUpdate({
        existingStep: buildCodeStep(),
        updatedStep: buildCodeStep({
          type: WorkflowActionType.SEND_EMAIL,
        } as Partial<WorkflowAction>),
      }),
    ).toThrow('Changing step type');
  });
});
