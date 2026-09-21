import { z } from 'zod';
import { baseWorkflowActionSettingsSchema } from './base-workflow-action-settings-schema';

export const workflowSearchLocalBusinessesActionSettingsSchema =
  baseWorkflowActionSettingsSchema.extend({
    input: z.object({
      query: z.string(),
      limit: z.number().optional().default(20),
      lat: z.number().optional(),
      lng: z.number().optional(),
      zoom: z.number().optional(),
      language: z.string().optional().default('en'),
      region: z.string().optional().default('us'),
      extractEmailsAndContacts: z.boolean().optional().default(false),
      subtypes: z.string().optional(),
      verified: z.boolean().optional(),
      businessStatus: z.string().optional(),
      fields: z.string().optional(),
      mode: z
        .enum(['search', 'search-nearby', 'search-in-area'])
        .optional()
        .default('search'),
    }),
  });
