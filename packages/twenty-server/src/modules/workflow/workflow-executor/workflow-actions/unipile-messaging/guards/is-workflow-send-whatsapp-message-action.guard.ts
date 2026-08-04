import { WorkflowActionType } from 'twenty-shared/workflow';

import {
  type WorkflowAction,
  type WorkflowSendWhatsappMessageAction,
} from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

export const isWorkflowSendWhatsappMessageAction = (
  action: WorkflowAction,
): action is WorkflowSendWhatsappMessageAction => {
  return action.type === WorkflowActionType.SEND_WHATSAPP_MESSAGE;
};
