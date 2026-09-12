import { WorkflowActionType } from 'twenty-shared/workflow';

import {
  type WorkflowAction,
  type WorkflowCommentOnLinkedinPostAction,
} from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

export const isWorkflowCommentOnLinkedinPostAction = (
  action: WorkflowAction,
): action is WorkflowCommentOnLinkedinPostAction => {
  return action.type === WorkflowActionType.COMMENT_ON_LINKEDIN_POST;
};
