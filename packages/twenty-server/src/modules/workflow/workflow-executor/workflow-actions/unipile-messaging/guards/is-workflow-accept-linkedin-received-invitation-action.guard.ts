import { WorkflowActionType } from 'twenty-shared/workflow';

import {
  type WorkflowAction,
  type WorkflowAcceptLinkedinReceivedInvitationAction,
} from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

export const isWorkflowAcceptLinkedinReceivedInvitationAction = (
  action: WorkflowAction,
): action is WorkflowAcceptLinkedinReceivedInvitationAction => {
  return action.type === WorkflowActionType.ACCEPT_LINKEDIN_RECEIVED_INVITATION;
};
