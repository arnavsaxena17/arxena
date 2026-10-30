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
      'Default ludicrous: a set described by attributes, planned into structured sharded queries, billed $0.002 per record. instant: one raw string. A website/domain (company) or LinkedIn URL is a lookup cut to the exact match and written; any other string is a probe of up to 25 preview rows, never written. smart is ignored',
    ),
  query: z
    .string()
    .describe(
      'Raw natural-language request; for mode instant a bare domain (stripe.com), a LinkedIn URL or a short literal. Ludicrous may be longer; instant max 200 characters',
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
  listId: z
    .string()
    .optional()
    .describe(
      'Ludicrous only. listId returned by the estimate call. Pass it after the user confirms the budget to fetch the records',
    ),
  maxBudgetUsd: z
    .number()
    .min(0.01)
    .max(10)
    .optional()
    .describe(
      'Ludicrous only. Spend cap in USD for this query, at most 10. Required together with listId',
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
  industries: z
    .array(z.string())
    .max(8)
    .optional()
    .describe(
      'Company only. Exact LinkedIn industry labels resolved with get_source_capabilities, e.g. ["Glass, Ceramics and Concrete Manufacturing"]. When set, the planner must use them instead of guessing a broader label. Do not pass made-up categories such as Fintech.',
    ),
});

export type SearchBrightDataBusinessToolInput = z.infer<
  typeof SearchBrightDataBusinessToolInputZodSchema
>;
