import { z } from 'zod';
import { baseWorkflowActionSettingsSchema } from './base-workflow-action-settings-schema';

export const workflowSendWhatsappMessageActionSettingsSchema =
  baseWorkflowActionSettingsSchema.extend({
    input: z.object({
      workspaceMemberId: z.string(),
      phone: z.string(),
      candidateId: z.string().optional(),
      body: z.string().optional().default(''),
    }),
  });
