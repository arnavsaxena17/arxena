import { WorkflowActionType } from 'twenty-shared';

import {
  type WorkflowAction,
  type WorkflowIfElseAction,
} from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

export const isWorkflowIfElseAction = (
  action: WorkflowAction,
): action is WorkflowIfElseAction => {
  return action.type === WorkflowActionType.IF_ELSE;
};
