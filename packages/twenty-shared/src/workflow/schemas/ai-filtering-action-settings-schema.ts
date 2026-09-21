import { z } from 'zod';

import { baseWorkflowActionSettingsSchema } from './base-workflow-action-settings-schema';

export const workflowAiFilteringFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string().optional(),
  enumValues: z.array(z.string()).optional(),
});

export const workflowAiFilteringActionSettingsSchema =
  baseWorkflowActionSettingsSchema.extend({
    input: z.object({
      candidates: z.unknown().optional(),
      name: z.string().optional().default(''),
      prompt: z.string().optional().default(''),
      selectedModel: z.string().optional().default('typesafe-ai/jev'),
      selectedMetadataFields: z.array(z.string()).optional().default([]),
      includeResume: z.boolean().optional().default(false),
      fields: z.array(workflowAiFilteringFieldSchema).optional().default([]),
      existingFilterId: z.string().optional(),
      filterDescription: z.string().optional().default(''),
    }),
  });
