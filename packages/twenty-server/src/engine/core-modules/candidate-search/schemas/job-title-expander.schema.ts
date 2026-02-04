import { z } from 'zod';

/**
 * Single seniority band entry (Agent 2 output).
 * Uses array format instead of z.record() because OpenAI structured output
 * does not support record/dynamic keys (additionalProperties).
 */
export const seniorityBandEntrySchema = z.object({
  band_key: z
    .string()
    .describe('Seniority band identifier e.g. manager_level, head_level, director_level'),
  titles: z.array(z.string()).describe('Role-specific title variations'),
  generic_titles: z
    .array(z.string())
    .nullable()
    .describe('Generic titles used at this level (e.g. Manager, Senior Executive)'),
});

/**
 * Seniority bands as array (z.record not supported by OpenAI zodResponseFormat)
 */
export const seniorityBandsSchema = z
  .array(seniorityBandEntrySchema)
  .describe('Titles grouped by seniority band');

/**
 * Title analysis from Agent 2 (Job Title Expander)
 */
export const jobTitleExpanderSchema = z.object({
  title_strategy: z.string().describe('e.g. high_variation, moderately_standardized, extremely_high_variation'),
  reasoning: z.string().nullable().describe('Why this strategy was chosen'),
  seniority_bands: seniorityBandsSchema.describe('Titles grouped by seniority band'),
  title_standardization_score: z.number().min(1).max(10).describe('1-10, 10 = highly standardized like Chartered Accountant'),
  recommendation: z.string().nullable().describe('e.g. Keywords Primary with broad title net'),
});

export type JobTitleExpanderResult = z.infer<typeof jobTitleExpanderSchema>;
export type SeniorityBandEntry = z.infer<typeof seniorityBandEntrySchema>;
export type SeniorityBands = z.infer<typeof seniorityBandsSchema>;
