import { z } from 'zod';
import {
    searchQuerySchema,
    termCountsSchema,
} from './search-query.schema';

const strategySchema = z.enum(['A', 'B', 'C', 'D']);

/**
 * Agent 4 (Factoring): factored query and splitting recommendation.
 */
export const agent4FactoringSchema = z.object({
  factored_query: searchQuerySchema.describe(
    'Factored boolean expressions for keywords/job_title; company, location, years preserved',
  ),
  term_counts: termCountsSchema.describe('Term counts after factoring'),
  needs_splitting: z.boolean().describe('True if still over limits after factoring'),
  splitting_reason: z.string().nullable().optional(),
  recommended_strategy: strategySchema.describe(
    'A: no split, B: split by keywords, C: split by job titles, D: split by seniority/companies',
  ),
});

export type Agent4FactoringResult = z.infer<typeof agent4FactoringSchema>;
