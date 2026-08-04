import { z } from 'zod';
import { baseWorkflowActionSchema } from './base-workflow-action-schema';
import { workflowSendLinkedinConnectionRequestActionSettingsSchema } from './send-linkedin-connection-request-action-settings-schema';

export const workflowSendLinkedinConnectionRequestActionSchema =
  baseWorkflowActionSchema.extend({
    type: z.literal('SEND_LINKEDIN_CONNECTION_REQUEST'),
    settings: workflowSendLinkedinConnectionRequestActionSettingsSchema,
  });
