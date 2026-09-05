import { isOutreachSequencerWorkflowName } from 'src/engine/core-modules/outreach-command/utils/resolve-outreach-pause-resume-workflow-ids.util';
import { WorkflowTriggerType } from 'src/modules/workflow/workflow-trigger/types/workflow-trigger.type';

// Soft throttle (100/min NOT_STARTED queue) is reserved for Outreach Stage B/C.
// Manual triggers, webhook Test clicks, and all other workflows enqueue immediately.
export const shouldImmediatelyEnqueueWorkflowRun = ({
  triggerType,
  workflowName,
}: {
  triggerType?: WorkflowTriggerType | null;
  workflowName?: string | null;
}): boolean => {
  if (triggerType === WorkflowTriggerType.MANUAL) {
    return true;
  }

  if (isOutreachSequencerWorkflowName(workflowName)) {
    return false;
  }

  return true;
};
