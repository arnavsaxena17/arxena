import { type WorkflowDelayDuration } from 'src/modules/workflow/workflow-executor/workflow-actions/delay/types/workflow-delay-action-input.type';
import { convertWorkflowDelayDurationToMs } from 'src/modules/workflow/workflow-executor/workflow-actions/delay/utils/convert-workflow-delay-duration-to-ms.util';

type PickRandomWorkflowDelayDurationMsArgs = {
  minDuration: WorkflowDelayDuration;
  maxDuration: WorkflowDelayDuration;
  random?: () => number;
};

export const pickRandomWorkflowDelayDurationMs = ({
  minDuration,
  maxDuration,
  random = Math.random,
}: PickRandomWorkflowDelayDurationMsArgs): number => {
  const minDelayInMs = convertWorkflowDelayDurationToMs(minDuration);
  const maxDelayInMs = convertWorkflowDelayDurationToMs(maxDuration);

  if (minDelayInMs > maxDelayInMs) {
    throw new Error(
      'Minimum delay duration must be less than or equal to maximum delay duration',
    );
  }

  if (minDelayInMs === maxDelayInMs) {
    return minDelayInMs;
  }

  return Math.floor(
    minDelayInMs + random() * (maxDelayInMs - minDelayInMs + 1),
  );
};
