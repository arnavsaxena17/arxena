import { z } from 'zod';

/**
 * Schema for sophisticated boolean query generation results
 * Used for Sales Navigator and Recruiter searches to generate comprehensive boolean queries
 * that capture different company nomenclatures for positions
 */
export const booleanQueryBuilderSchema = z.object({
  booleanQuery: z.string().describe('Sophisticated boolean query string combining hierarchical and domain terms (e.g., "(Operations AND (GM OR President OR vp OR agm OR head)) OR ((plant OR unit OR works OR site) AND (head))")'),
  reasoning: z.string().describe('Explanation of how the boolean query was constructed and why it captures different nomenclatures'),
  hierarchicalTermsUsed: z.array(z.string()).nullable().optional().describe('List of hierarchical terms used in the query'),
  domainTermsUsed: z.array(z.string()).nullable().optional().describe('List of domain/functional terms used in the query'),
  alternativeQueries: z.array(z.string()).nullable().optional().describe('Alternative boolean query formulations if the primary one doesn\'t work well'),
});

export type BooleanQueryBuilderResult = z.infer<typeof booleanQueryBuilderSchema>;
