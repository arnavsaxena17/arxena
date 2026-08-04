import { type BaseWorkflowActionSettings } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action-settings.type';

import { type WorkflowSendLinkedinInmailActionInput } from './workflow-send-linkedin-inmail-action-input.type';

export type WorkflowSendLinkedinInmailActionSettings =
  BaseWorkflowActionSettings & {
    input: WorkflowSendLinkedinInmailActionInput;
  };
