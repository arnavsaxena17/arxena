import { WorkflowStep, WorkflowTrigger } from '@/workflow/types/Workflow';
import { WorkflowDiagramCreateStepConnectionOptions } from '@/workflow/workflow-diagram/types/WorkflowDiagram';
import { isDefined } from 'twenty-shared';

/**
 * Legacy workflows store steps as a strictly linear array without
 * `nextStepIds`. Before mutating the graph we materialize the linear chain
 * for the whole flow so we never persist a mixed state where only some steps
 * carry `nextStepIds` (which would disconnect the remaining nodes in the
 * diagram). Flows that already declare `nextStepIds` are returned untouched.
 */
const normalizeFlowToGraph = ({
  trigger,
  steps,
}: {
  trigger: WorkflowTrigger | null | undefined;
  steps: WorkflowStep[];
}): {
  trigger: WorkflowTrigger | null | undefined;
  steps: WorkflowStep[];
} => {
  const isAlreadyGraph =
    isDefined(trigger?.nextStepIds) ||
    steps.some((step) => isDefined(step.nextStepIds));

  if (isAlreadyGraph) {
    return { trigger, steps };
  }

  const normalizedSteps = steps.map((step, index) => ({
    ...step,
    nextStepIds: index < steps.length - 1 ? [steps[index + 1].id] : [],
  }));

  const normalizedTrigger = isDefined(trigger)
    ? {
        ...trigger,
        nextStepIds: steps.length > 0 ? [steps[0].id] : [],
      }
    : trigger;

  return { trigger: normalizedTrigger, steps: normalizedSteps };
};

const insertNextStepId = ({
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

export const linkParentStepToChild = ({
  step,
  newStepId,
  nextStepId,
  connectionOptions,
}: {
  step: WorkflowStep;
  newStepId: string;
  nextStepId?: string;
  connectionOptions?: WorkflowDiagramCreateStepConnectionOptions;
}): WorkflowStep => {
  if (step.type === 'IF_ELSE' && isDefined(connectionOptions?.branchId)) {
    return {
      ...step,
      settings: {
        ...step.settings,
        input: {
          ...step.settings.input,
          branches: (step.settings.input.branches ?? []).map((branch) =>
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
    };
  }

  if (step.type === 'ITERATOR' && connectionOptions?.isLoopEntry === true) {
    return {
      ...step,
      settings: {
        ...step.settings,
        input: {
          ...step.settings.input,
          initialLoopStepIds: insertNextStepId({
            nextStepIds: step.settings.input.initialLoopStepIds,
            newStepId,
            nextStepId,
          }),
        },
      },
    };
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

export const insertStepInWorkflowVersion = ({
  steps,
  trigger,
  newStep,
  parentStepId,
  nextStepId,
  connectionOptions,
  triggerStepId,
}: {
  steps: WorkflowStep[];
  trigger: WorkflowTrigger | null | undefined;
  newStep: WorkflowStep;
  parentStepId?: string;
  nextStepId?: string;
  connectionOptions?: WorkflowDiagramCreateStepConnectionOptions;
  triggerStepId: string;
}): {
  steps: WorkflowStep[];
  trigger: WorkflowTrigger | null | undefined;
} => {
  const { trigger: normalizedTrigger, steps: normalizedSteps } =
    normalizeFlowToGraph({ trigger, steps });

  let updatedSteps = [...normalizedSteps, newStep];
  let updatedTrigger = normalizedTrigger;

  if (isDefined(parentStepId)) {
    if (parentStepId === triggerStepId) {
      if (isDefined(updatedTrigger)) {
        updatedTrigger = {
          ...updatedTrigger,
          nextStepIds: insertNextStepId({
            nextStepIds: updatedTrigger.nextStepIds,
            newStepId: newStep.id,
            nextStepId,
          }),
        };
      }
    } else {
      updatedSteps = updatedSteps.map((step) =>
        step.id === parentStepId
          ? linkParentStepToChild({
              step,
              newStepId: newStep.id,
              nextStepId,
              connectionOptions,
            })
          : step,
      );
    }
  }

  return {
    steps: updatedSteps,
    trigger: updatedTrigger,
  };
};
