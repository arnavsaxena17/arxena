import { z } from 'zod';
import {
    searchQuerySchema,
    termCountsSchema,
} from './search-query.schema';

const strategySchema = z.enum(['A', 'B', 'C', 'D']);

const primaryQuerySchema = z.object({
  query: searchQuerySchema.describe('Full query using all terms from master lists'),
  term_counts: termCountsSchema.describe('Discrete term counts for keywords, job_title, combined'),
  needs_splitting: z.boolean().describe('True if keywords >6 OR job_title >6 OR combined >10'),
  splitting_reason: z.string().nullable().optional(),
  recommended_strategy: strategySchema.describe(
    'A: no split, B: split by keywords, C: split by job titles, D: split by seniority/companies',
  ),
});

/**
 * Agent 3 (Primary Query): response is a single object with primary_query.
 */
export const agent3PrimaryQueryResponseSchema = z.object({
  primary_query: primaryQuerySchema,
});

export type Agent3PrimaryQueryResult = z.infer<typeof primaryQuerySchema>;
export type Agent3PrimaryQueryResponse = z.infer<
  typeof agent3PrimaryQueryResponseSchema
>;
