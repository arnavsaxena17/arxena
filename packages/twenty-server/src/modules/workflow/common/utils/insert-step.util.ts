import { isDefined } from 'twenty-shared';

import { WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

/**
 * Inserts a new step id into an outgoing connection list. When a `nextStepId`
 * is provided (mid-chain insertion), it replaces that id with the new step id.
 * Otherwise the new step id is appended.
 */
export const insertNextStepId = ({
  nextStepIds,
  newStepId,
  nextStepId,
}: {
  nextStepIds: string[] | undefined;
  newStepId: string;
  nextStepId?: string;
}): string[] => {
  const currentNextStepIds = nextStepIds ?? [];

  if (isDefined(nextStepId) && currentNextStepIds.includes(nextStepId)) {
    return currentNextStepIds.map((stepId) =>
      stepId === nextStepId ? newStepId : stepId,
    );
  }

  if (currentNextStepIds.includes(newStepId)) {
    return currentNextStepIds;
  }

  return [...currentNextStepIds, newStepId];
};

/**
 * Connects a newly created step to its parent step, honoring branch-aware
 * connections for IF_ELSE (branchId) and ITERATOR (loop entry) parents.
 */
export const linkParentStepToChild = ({
  step,
  newStepId,
  nextStepId,
  connectionOptions,
}: {
  step: WorkflowAction;
  newStepId: string;
  nextStepId?: string;
  connectionOptions?: {
    branchId?: string;
    isLoopEntry?: boolean;
  };
}): WorkflowAction => {
  if (isDefined(connectionOptions?.branchId)) {
    const settings = step.settings as {
      input?: {
        branches?: Array<{ id: string; nextStepIds: string[] }>;
      };
    };

    const branches = settings.input?.branches ?? [];

    return {
      ...step,
      settings: {
        ...step.settings,
        input: {
          ...settings.input,
          branches: branches.map((branch) =>
            branch.id === connectionOptions?.branchId
              ? {
                  ...branch,
                  nextStepIds: insertNextStepId({
                    nextStepIds: branch.nextStepIds,
                    newStepId,
                    nextStepId,
                  }),
                }
              : branch,
          ),
        },
      },
    } as WorkflowAction;
  }

  if (connectionOptions?.isLoopEntry === true) {
    const settings = step.settings as {
      input?: {
        initialLoopStepIds?: string[];
      };
    };

    return {
      ...step,
      settings: {
        ...step.settings,
        input: {
          ...settings.input,
          initialLoopStepIds: insertNextStepId({
            nextStepIds: settings.input?.initialLoopStepIds,
            newStepId,
            nextStepId,
          }),
        },
      },
    } as WorkflowAction;
  }

  return {
    ...step,
    nextStepIds: insertNextStepId({
      nextStepIds: step.nextStepIds,
      newStepId,
      nextStepId,
    }),
  };
};
