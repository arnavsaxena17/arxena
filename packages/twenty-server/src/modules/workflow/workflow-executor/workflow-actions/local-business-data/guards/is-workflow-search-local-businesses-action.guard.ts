import { WorkflowActionType } from 'twenty-shared/workflow';
import {
  type WorkflowAction,
  type WorkflowSearchLocalBusinessesAction,
} from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

export const isWorkflowSearchLocalBusinessesAction = (
  action: WorkflowAction,
): action is WorkflowSearchLocalBusinessesAction => {
  return action.type === WorkflowActionType.SEARCH_LOCAL_BUSINESSES;
};
