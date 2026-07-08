import { WorkflowActionType } from 'twenty-shared';

import {
  type WorkflowAction,
  type WorkflowEmptyAction,
} from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

export const isWorkflowEmptyAction = (
  action: WorkflowAction,
): action is WorkflowEmptyAction => {
  return action.type === WorkflowActionType.EMPTY;
};
