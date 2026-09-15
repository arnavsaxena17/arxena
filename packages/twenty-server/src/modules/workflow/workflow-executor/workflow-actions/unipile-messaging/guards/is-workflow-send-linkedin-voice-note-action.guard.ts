import { WorkflowActionType } from 'twenty-shared/workflow';

import {
  type WorkflowAction,
  type WorkflowSendLinkedinVoiceNoteAction,
} from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';

export const isWorkflowSendLinkedinVoiceNoteAction = (
  action: WorkflowAction,
): action is WorkflowSendLinkedinVoiceNoteAction => {
  return action.type === WorkflowActionType.SEND_LINKEDIN_VOICE_NOTE;
};
