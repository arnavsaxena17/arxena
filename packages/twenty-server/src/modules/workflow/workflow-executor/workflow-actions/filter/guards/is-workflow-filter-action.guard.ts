import { WorkflowActionType } from 'twenty-shared';

import {
  type WorkflowAction,
  type WorkflowFilterAction,
} from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

export const isWorkflowFilterAction = (
  action: WorkflowAction,
): action is WorkflowFilterAction => {
  return action.type === WorkflowActionType.FILTER;
};
