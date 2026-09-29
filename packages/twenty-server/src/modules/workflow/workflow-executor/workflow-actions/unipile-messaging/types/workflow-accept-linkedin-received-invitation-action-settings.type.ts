import { type BaseWorkflowActionSettings } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action-settings.type';

import { type WorkflowAcceptLinkedinReceivedInvitationActionInput } from './workflow-accept-linkedin-received-invitation-action-input.type';

export type WorkflowAcceptLinkedinReceivedInvitationActionSettings =
  BaseWorkflowActionSettings & {
    input: WorkflowAcceptLinkedinReceivedInvitationActionInput;
  };
