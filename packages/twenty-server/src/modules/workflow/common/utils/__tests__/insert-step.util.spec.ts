import {
  insertNextStepId,
  linkParentStepToChild,
} from 'src/modules/workflow/common/utils/insert-step.util';
import { WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

describe('insertNextStepId', () => {
  it('appends the new step id when there is no next step', () => {
    expect(
      insertNextStepId({
        nextStepIds: undefined,
        newStepId: 'new',
      }),
    ).toEqual(['new']);
  });

  it('replaces the next step id when inserting in the middle of a chain', () => {
    expect(
      insertNextStepId({
        nextStepIds: ['a', 'old', 'b'],
        newStepId: 'new',
        nextStepId: 'old',
      }),
    ).toEqual(['a', 'new', 'b']);
  });

  it('does not duplicate an already-present step id', () => {
    expect(
      insertNextStepId({
        nextStepIds: ['new'],
        newStepId: 'new',
      }),
    ).toEqual(['new']);
  });
});

describe('linkParentStepToChild', () => {
  it('links to a default step nextStepIds', () => {
    const step = {
      id: 'parent',
      name: 'Parent',
      type: 'CODE',
      valid: true,
      nextStepIds: [],
      settings: { input: {}, outputSchema: {} },
    } as unknown as WorkflowAction;

    const result = linkParentStepToChild({
      step,
      newStepId: 'child',
    });

    expect(result.nextStepIds).toEqual(['child']);
  });

  it('links to the matching if-else branch', () => {
    const step = {
      id: 'if-else',
      name: 'If/Else',
      type: 'IF_ELSE',
      valid: true,
      nextStepIds: [],
      settings: {
        input: {
          branches: [
            { id: 'branch-1', nextStepIds: [] },
            { id: 'branch-2', nextStepIds: [] },
          ],
        },
        outputSchema: {},
      },
    } as unknown as WorkflowAction;

    const result = linkParentStepToChild({
      step,
      newStepId: 'child',
      connectionOptions: { branchId: 'branch-2' },
    });

    const branches = (result.settings as any).input.branches;

    expect(branches[0].nextStepIds).toEqual([]);
    expect(branches[1].nextStepIds).toEqual(['child']);
    expect(result.nextStepIds).toEqual([]);
  });

  it('links to the iterator loop entry', () => {
    const step = {
      id: 'iterator',
      name: 'Iterator',
      type: 'ITERATOR',
      valid: true,
      nextStepIds: [],
      settings: {
        input: { initialLoopStepIds: [] },
        outputSchema: {},
      },
    } as unknown as WorkflowAction;

    const result = linkParentStepToChild({
      step,
      newStepId: 'loop-body',
      connectionOptions: { isLoopEntry: true },
    });

    expect((result.settings as any).input.initialLoopStepIds).toEqual([
      'loop-body',
    ]);
  });
});
