import { z } from 'zod';

import { baseWorkflowActionSettingsSchema } from './base-workflow-action-settings-schema';

export const workflowSearchBrightDataBusinessActionInputSchema = z.object({
  query: z.string(),
  mode: z
    .enum(['ludicrous', 'smart', 'instant'])
    .optional()
    .default('ludicrous'),
  limit: z.number().optional(),
  offset: z.number().optional(),
  view: z.enum(['full', 'summary', 'id_only']).optional().default('full'),
  projectId: z.string().optional(),
  // Ludicrous only: spend cap in USD for this step (max 10)
  maxBudgetUsd: z.number().min(0.01).max(10).optional(),
  targetCount: z.number().min(1).max(5000).optional(),
});

export const workflowSearchBrightDataCompaniesActionSettingsSchema =
  baseWorkflowActionSettingsSchema.extend({
    input: workflowSearchBrightDataBusinessActionInputSchema,
  });

export const workflowSearchBrightDataPeopleActionSettingsSchema =
  workflowSearchBrightDataCompaniesActionSettingsSchema;
