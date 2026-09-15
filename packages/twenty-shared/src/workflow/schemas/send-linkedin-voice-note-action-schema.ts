import { z } from 'zod';
import { baseWorkflowActionSchema } from './base-workflow-action-schema';
import { workflowSendLinkedinVoiceNoteActionSettingsSchema } from './send-linkedin-voice-note-action-settings-schema';

export const workflowSendLinkedinVoiceNoteActionSchema =
  baseWorkflowActionSchema.extend({
    type: z.literal('SEND_LINKEDIN_VOICE_NOTE'),
    settings: workflowSendLinkedinVoiceNoteActionSettingsSchema,
  });
