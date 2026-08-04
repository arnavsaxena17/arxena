import { WorkflowActionType } from 'twenty-shared/workflow';

import {
  type WorkflowAction,
  type WorkflowSendLinkedinMessageAction,
} from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

export const isWorkflowSendLinkedinMessageAction = (
  action: WorkflowAction,
): action is WorkflowSendLinkedinMessageAction => {
  return action.type === WorkflowActionType.SEND_LINKEDIN_MESSAGE;
};
