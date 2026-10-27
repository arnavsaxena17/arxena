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
      'Default ludicrous: a set described by attributes, planned into structured sharded queries, billed $0.002 per record. Pass instant only with entity company for a lookup by website (bare host or URL, no spaces); the tool filters to that website host. Any other instant call runs as ludicrous. smart is ignored',
    ),
  query: z
    .string()
    .describe(
      'Raw natural-language request, or for mode instant a bare domain/URL (e.g. stripe.com). Not a LinkedIn URL. Ludicrous may be longer; instant max 200 characters',
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
});

export type SearchBrightDataBusinessToolInput = z.infer<
  typeof SearchBrightDataBusinessToolInputZodSchema
>;
