import { WorkflowActionType } from 'twenty-shared/workflow';

import {
  type WorkflowAction,
  type WorkflowViewLinkedinProfileAction,
} from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

export const isWorkflowViewLinkedinProfileAction = (
  action: WorkflowAction,
): action is WorkflowViewLinkedinProfileAction => {
  return action.type === WorkflowActionType.VIEW_LINKEDIN_PROFILE;
};
