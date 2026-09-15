import { WorkflowActionType } from 'twenty-shared/workflow';

import {
  type WorkflowAction,
  type WorkflowLikeLinkedinPostAction,
} from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

export const isWorkflowLikeLinkedinPostAction = (
  action: WorkflowAction,
): action is WorkflowLikeLinkedinPostAction => {
  return action.type === WorkflowActionType.LIKE_LINKEDIN_POST;
};
