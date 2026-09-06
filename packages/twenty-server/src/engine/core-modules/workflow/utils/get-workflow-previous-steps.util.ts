import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';
import {
  extractVariablesFromInput,
  TRIGGER_STEP_ID,
} from 'twenty-shared/workflow';

import { isWorkflowIfElseAction } from 'src/modules/workflow/workflow-executor/workflow-actions/if-else/guards/is-workflow-if-else-action.guard';
import { type WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

const isParentStep = ({
  currentStep,
  potentialParentStep,
}: {
  currentStep: WorkflowAction;
  potentialParentStep: WorkflowAction;
}): boolean => {
  if (isWorkflowIfElseAction(potentialParentStep)) {
    return (
      potentialParentStep.settings.input.branches?.some((branch) =>
        branch.nextStepIds?.includes(currentStep.id),
      ) === true
    );
  }

  return potentialParentStep.nextStepIds?.includes(currentStep.id) === true;
};

export const getWorkflowPreviousSteps = ({
  steps,
  currentStep,
  visitedStepIds = new Set([currentStep.id]),
}: {
  steps: WorkflowAction[];
  currentStep: WorkflowAction;
  visitedStepIds?: Set<string>;
}): WorkflowAction[] => {
  const parentSteps = steps.filter(
    (step) =>
      !visitedStepIds.has(step.id) &&
      isParentStep({ currentStep, potentialParentStep: step }),
  );

  const ancestorSteps = parentSteps.flatMap((parentStep) => {
    visitedStepIds.add(parentStep.id);

    return getWorkflowPreviousSteps({
      steps,
      currentStep: parentStep,
      visitedStepIds,
    });
  });

  return [...ancestorSteps, ...parentSteps];
};

export const getWorkflowStepsToHydrateForPrompt = ({
  steps,
  currentStep,
  prompt,
}: {
  steps: WorkflowAction[];
  currentStep: WorkflowAction;
  prompt: string;
}): WorkflowAction[] => {
  const stepsById = new Map(
    steps.map((workflowStep) => [workflowStep.id, workflowStep]),
  );
  const orderedSteps: WorkflowAction[] = [];
  const seenStepIds = new Set<string>();

  const appendSteps = (stepsToAppend: WorkflowAction[]) => {
    for (const workflowStep of stepsToAppend) {
      if (seenStepIds.has(workflowStep.id)) {
        continue;
      }

      seenStepIds.add(workflowStep.id);
      orderedSteps.push(workflowStep);
    }
  };

  appendSteps(getWorkflowPreviousSteps({ steps, currentStep }));

  const referencedStepIds = [
    ...new Set(
      extractVariablesFromInput(prompt).map(
        (variablePath) => variablePath.split('.')[0],
      ),
    ),
  ].filter(
    (stepId) =>
      isNonEmptyString(stepId) &&
      stepId !== TRIGGER_STEP_ID &&
      stepId !== currentStep.id,
  );

  for (const referencedStepId of referencedStepIds) {
    const referencedStep = stepsById.get(referencedStepId);

    if (!isDefined(referencedStep) || seenStepIds.has(referencedStep.id)) {
      continue;
    }

    appendSteps(
      getWorkflowPreviousSteps({
        steps,
        currentStep: referencedStep,
      }),
    );
    appendSteps([referencedStep]);
  }

  return orderedSteps;
};

export const findWorkflowStepOrThrow = ({
  steps,
  stepId,
}: {
  steps: WorkflowAction[];
  stepId: string;
}): WorkflowAction => {
  const step = steps.find((workflowStep) => workflowStep.id === stepId);

  if (!isDefined(step)) {
    throw new Error(`Workflow step ${stepId} was not found`);
  }

  return step;
};
