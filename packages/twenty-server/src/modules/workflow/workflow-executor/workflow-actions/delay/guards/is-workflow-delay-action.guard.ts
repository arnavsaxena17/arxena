import { WorkflowActionType } from 'twenty-shared';

import {
  type WorkflowAction,
  type WorkflowDelayAction,
} from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

export const isWorkflowDelayAction = (
  action: WorkflowAction,
): action is WorkflowDelayAction => {
  return action.type === WorkflowActionType.DELAY;
};
