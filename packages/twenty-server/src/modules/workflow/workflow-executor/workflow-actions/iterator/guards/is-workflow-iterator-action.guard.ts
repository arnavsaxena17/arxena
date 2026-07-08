import { WorkflowActionType } from 'twenty-shared';

import {
  type WorkflowAction,
  type WorkflowIteratorAction,
} from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

export const isWorkflowIteratorAction = (
  action: WorkflowAction,
): action is WorkflowIteratorAction => {
  return action.type === WorkflowActionType.ITERATOR;
};
