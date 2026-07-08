import { isDefined } from 'twenty-shared';

import { WorkflowAction } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';
import { WorkflowTrigger } from 'src/modules/workflow/workflow-trigger/types/workflow-trigger.type';

/**
 * Legacy workflow versions store steps as a strictly linear array without
 * `nextStepIds`. The graph executor requires an explicit adjacency list.
 * This normalizes any flow that has not been migrated yet into an equivalent
 * linear DAG so old workflows keep running unchanged. Flows that already
 * declare `nextStepIds` are returned untouched.
 */
export const normalizeFlowToGraph = ({
  trigger,
  steps,
}: {
  trigger: WorkflowTrigger;
  steps: WorkflowAction[];
}): { trigger: WorkflowTrigger; steps: WorkflowAction[] } => {
  const isAlreadyGraph =
    isDefined(trigger.nextStepIds) ||
    steps.some((step) => isDefined(step.nextStepIds));

  if (isAlreadyGraph) {
    return { trigger, steps };
  }

  const normalizedSteps = steps.map((step, index) => ({
    ...step,
    nextStepIds:
      index < steps.length - 1 ? [steps[index + 1].id] : [],
  }));

  const normalizedTrigger = {
    ...trigger,
    nextStepIds: steps.length > 0 ? [steps[0].id] : [],
  };

  return { trigger: normalizedTrigger, steps: normalizedSteps };
};
