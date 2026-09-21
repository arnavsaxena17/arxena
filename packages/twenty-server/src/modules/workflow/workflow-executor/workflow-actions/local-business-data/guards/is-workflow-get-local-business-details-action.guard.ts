import { WorkflowActionType } from 'twenty-shared/workflow';
import {
  type WorkflowAction,
  type WorkflowGetLocalBusinessDetailsAction,
} from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

export const isWorkflowGetLocalBusinessDetailsAction = (
  action: WorkflowAction,
): action is WorkflowGetLocalBusinessDetailsAction => {
  return action.type === WorkflowActionType.GET_LOCAL_BUSINESS_DETAILS;
};
