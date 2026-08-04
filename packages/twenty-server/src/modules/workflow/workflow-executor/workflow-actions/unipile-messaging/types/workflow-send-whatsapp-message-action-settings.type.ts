import { type BaseWorkflowActionSettings } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action-settings.type';

import { type WorkflowSendWhatsappMessageActionInput } from './workflow-send-whatsapp-message-action-input.type';

export type WorkflowSendWhatsappMessageActionSettings =
  BaseWorkflowActionSettings & {
    input: WorkflowSendWhatsappMessageActionInput;
  };
