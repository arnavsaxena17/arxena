import { WorkflowActionType } from 'twenty-shared/workflow';

import {
  type WorkflowAction,
  type WorkflowFollowLinkedinProfileAction,
} from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

export const isWorkflowFollowLinkedinProfileAction = (
  action: WorkflowAction,
): action is WorkflowFollowLinkedinProfileAction => {
  return action.type === WorkflowActionType.FOLLOW_LINKEDIN_PROFILE;
};
