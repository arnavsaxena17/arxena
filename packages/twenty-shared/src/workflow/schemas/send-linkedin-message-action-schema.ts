import { z } from 'zod';
import { baseWorkflowActionSchema } from './base-workflow-action-schema';
import { workflowSendLinkedinMessageActionSettingsSchema } from './send-linkedin-message-action-settings-schema';

export const workflowSendLinkedinMessageActionSchema =
  baseWorkflowActionSchema.extend({
    type: z.literal('SEND_LINKEDIN_MESSAGE'),
    settings: workflowSendLinkedinMessageActionSettingsSchema,
  });
