import { type BaseWorkflowActionSettings } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action-settings.type';

import { type WorkflowSendLinkedinConnectionRequestActionInput } from './workflow-send-linkedin-connection-request-action-input.type';

export type WorkflowSendLinkedinConnectionRequestActionSettings =
  BaseWorkflowActionSettings & {
    input: WorkflowSendLinkedinConnectionRequestActionInput;
  };
