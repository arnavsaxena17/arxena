import { WorkflowActionType } from 'twenty-shared/workflow';

import {
  type WorkflowAction,
  type WorkflowSendLinkedinInmailAction,
} from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

export const isWorkflowSendLinkedinInmailAction = (
  action: WorkflowAction,
): action is WorkflowSendLinkedinInmailAction => {
  return action.type === WorkflowActionType.SEND_LINKEDIN_INMAIL;
};
