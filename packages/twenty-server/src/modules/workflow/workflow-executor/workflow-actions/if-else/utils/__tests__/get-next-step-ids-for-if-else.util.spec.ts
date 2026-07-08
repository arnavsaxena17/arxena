import { WorkflowActionType } from 'twenty-shared';

import { getNextStepIdsForIfElse } from 'src/modules/workflow/workflow-executor/workflow-actions/if-else/utils/get-next-step-ids-for-if-else.util';
import { type WorkflowIfElseAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

const buildIfElseAction = (): WorkflowIfElseAction =>
  ({
    id: 'if-else',
    name: 'If/Else',
    type: WorkflowActionType.IF_ELSE,
    valid: true,
    settings: {
      input: {
        stepFilterGroups: [],
        stepFilters: [],
        branches: [
          { id: 'true-branch', nextStepIds: ['step-true'] },
          { id: 'false-branch', nextStepIds: ['step-false'] },
        ],
      },
      outputSchema: {},
      errorHandlingOptions: {
        retryOnFailure: { value: false },
        continueOnFailure: { value: false },
      },
    },
  }) as unknown as WorkflowIfElseAction;

describe('getNextStepIdsForIfElse', () => {
  it('executes the matching branch and skips the others', () => {
    const result = getNextStepIdsForIfElse({
      executedStep: buildIfElseAction(),
      executedStepOutput: { result: { matchingBranchId: 'true-branch' } },
    });

    // eslint-disable-next-line no-console
    console.log('if-else match result', result);

    expect(result.nextStepIdsToExecute).toEqual(['step-true']);
    expect(result.nextStepIdsToSkip).toEqual(['step-false']);
  });

  it('skips every branch when there is no matching branch', () => {
    const result = getNextStepIdsForIfElse({
      executedStep: buildIfElseAction(),
      executedStepOutput: { result: {} },
    });

    // eslint-disable-next-line no-console
    console.log('if-else no-match result', result);

    expect(result.nextStepIdsToSkip).toEqual(['step-true', 'step-false']);
    expect(result.nextStepIdsToExecute).toBeUndefined();
  });

  it('fails safely on every branch when shouldFailSafely is set', () => {
    const result = getNextStepIdsForIfElse({
      executedStep: buildIfElseAction(),
      executedStepOutput: { shouldFailSafely: true },
    });

    expect(result.nextStepIdsToFailSafely).toEqual(['step-true', 'step-false']);
  });
});
