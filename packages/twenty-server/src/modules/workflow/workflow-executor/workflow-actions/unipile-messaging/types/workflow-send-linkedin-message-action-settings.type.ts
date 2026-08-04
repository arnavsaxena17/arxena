import { type BaseWorkflowActionSettings } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action-settings.type';

import { type WorkflowSendLinkedinMessageActionInput } from './workflow-send-linkedin-message-action-input.type';

export type WorkflowSendLinkedinMessageActionSettings =
  BaseWorkflowActionSettings & {
    input: WorkflowSendLinkedinMessageActionInput;
  };
