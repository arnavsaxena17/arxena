import { WorkflowActionType } from 'twenty-shared/workflow';

import {
  type WorkflowAction,
  type WorkflowSendLinkedinConnectionRequestAction,
} from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

export const isWorkflowSendLinkedinConnectionRequestAction = (
  action: WorkflowAction,
): action is WorkflowSendLinkedinConnectionRequestAction => {
  return action.type === WorkflowActionType.SEND_LINKEDIN_CONNECTION_REQUEST;
};
