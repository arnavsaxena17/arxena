import { z } from 'zod';
import { baseWorkflowActionSchema } from './base-workflow-action-schema';
import { workflowSendLinkedinInmailActionSettingsSchema } from './send-linkedin-inmail-action-settings-schema';

export const workflowSendLinkedinInmailActionSchema =
  baseWorkflowActionSchema.extend({
    type: z.literal('SEND_LINKEDIN_INMAIL'),
    settings: workflowSendLinkedinInmailActionSettingsSchema,
  });
