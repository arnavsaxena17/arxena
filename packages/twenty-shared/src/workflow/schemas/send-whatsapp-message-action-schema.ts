import { z } from 'zod';
import { baseWorkflowActionSchema } from './base-workflow-action-schema';
import { workflowSendWhatsappMessageActionSettingsSchema } from './send-whatsapp-message-action-settings-schema';

export const workflowSendWhatsappMessageActionSchema =
  baseWorkflowActionSchema.extend({
    type: z.literal('SEND_WHATSAPP_MESSAGE'),
    settings: workflowSendWhatsappMessageActionSettingsSchema,
  });
