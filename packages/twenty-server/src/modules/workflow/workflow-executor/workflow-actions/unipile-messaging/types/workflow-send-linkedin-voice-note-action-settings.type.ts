import { type BaseWorkflowActionSettings } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action-settings.type';

import { type WorkflowSendLinkedinVoiceNoteActionInput } from './workflow-send-linkedin-voice-note-action-input.type';

export type WorkflowSendLinkedinVoiceNoteActionSettings =
  BaseWorkflowActionSettings & {
    input: WorkflowSendLinkedinVoiceNoteActionInput;
  };
