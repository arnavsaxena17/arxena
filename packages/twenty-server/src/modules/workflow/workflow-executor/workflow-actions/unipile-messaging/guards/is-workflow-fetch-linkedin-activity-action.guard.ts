import { WorkflowActionType } from 'twenty-shared/workflow';

import {
  type WorkflowAction,
  type WorkflowFetchLinkedinActivityAction,
} from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

export const isWorkflowFetchLinkedinActivityAction = (
  action: WorkflowAction,
): action is WorkflowFetchLinkedinActivityAction => {
  return action.type === WorkflowActionType.FETCH_LINKEDIN_ACTIVITY;
};
