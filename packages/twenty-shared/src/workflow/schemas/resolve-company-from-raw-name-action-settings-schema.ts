import { z } from 'zod';
import { baseWorkflowActionSettingsSchema } from './base-workflow-action-settings-schema';

export const workflowResolveCompanyFromRawNameActionSettingsSchema =
  baseWorkflowActionSettingsSchema.extend({
    input: z.object({
      companyName: z.string().optional().default(''),
      companyNames: z.array(z.string()).optional().default([]),
    }),
  });
