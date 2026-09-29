import { WorkflowActionType } from 'twenty-shared/workflow';
import {
  type WorkflowAction,
  type WorkflowResolveCompanyFromRawNameAction,
} from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

export const isWorkflowResolveCompanyFromRawNameAction = (
  action: WorkflowAction,
): action is WorkflowResolveCompanyFromRawNameAction => {
  return action.type === WorkflowActionType.RESOLVE_COMPANY_FROM_RAW_NAME;
};
