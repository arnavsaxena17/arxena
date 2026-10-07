import { z } from 'zod';

export const SearchBrightDataBusinessToolInputZodSchema = z.object({
  entity: z
    .enum(['company', 'people'])
    .describe('company searches companies; people searches people'),
  mode: z
    .enum(['ludicrous', 'smart', 'instant'])
    .optional()
    .default('ludicrous')
    .describe(
      'ludicrous (default) plans structured sharded queries from your raw request and bills $0.002 per record; smart ranks by relevance; instant is a fast lexical search',
    ),
  query: z
    .string()
    .describe(
      'Raw natural-language request. For smart/instant it is passed to Bright Data (max 200 characters); for ludicrous it is planned into several structured queries and may be longer',
    ),
  limit: z.number().min(1).max(1000).optional(),
  offset: z.number().min(0).optional(),
  view: z.enum(['full', 'summary', 'id_only']).optional().default('full'),
  projectId: z
    .string()
    .optional()
    .describe(
      'When set with a workspace, merge hits into the outreach ephemeral tab',
    ),
  planId: z
    .string()
    .optional()
    .describe(
      'Ludicrous only. Plan id returned by the estimate call. Pass it after the user confirms the budget to fetch the records',
    ),
  maxBudgetUsd: z
    .number()
    .min(0.01)
    .max(10)
    .optional()
    .describe(
      'Ludicrous only. Spend cap in USD for this query, at most 10. Required together with planId',
    ),
  targetCount: z
    .number()
    .min(1)
    .max(5000)
    .optional()
    .describe('Ludicrous only. Stop once this many relevant records are kept'),
  autoExecute: z
    .boolean()
    .optional()
    .describe(
      'Ludicrous only. Skip the confirmation step and fetch within maxBudgetUsd straight away. Used by workflow steps, which cannot pause',
    ),
});

export type SearchBrightDataBusinessToolInput = z.infer<
  typeof SearchBrightDataBusinessToolInputZodSchema
>;
