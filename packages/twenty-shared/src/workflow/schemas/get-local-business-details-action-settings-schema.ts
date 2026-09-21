import { z } from 'zod';
import { baseWorkflowActionSettingsSchema } from './base-workflow-action-settings-schema';

export const workflowGetLocalBusinessDetailsActionSettingsSchema =
  baseWorkflowActionSettingsSchema.extend({
    input: z.object({
      businessIds: z.array(z.string()).min(1).max(20),
      extractEmailsAndContacts: z.boolean().optional().default(true),
      extractShareLink: z.boolean().optional().default(false),
      language: z.string().optional().default('en'),
      region: z.string().optional().default('us'),
      fields: z.string().optional(),
    }),
  });
