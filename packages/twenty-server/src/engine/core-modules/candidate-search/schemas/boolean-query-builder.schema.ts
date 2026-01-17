import { z } from 'zod';


/**
 * Schema for term categorization analysis
 */
export const termAnalysisSchema = z.object({
  expand: z.array(z.string()).nullable().optional().describe('Terms that expand results (broad terms that increase candidate pool)'),
  filter: z.array(z.string()).nullable().optional().describe('Terms that filter results (specific terms that narrow candidate pool)'),
  essential: z.array(z.string()).nullable().optional().describe('Essential terms that must be included (must-have terms)'),
  optional: z.array(z.string()).nullable().optional().describe('Optional terms (nice-to-have terms)'),
  exclude: z.array(z.string()).nullable().optional().describe('Terms to exclude (NOT terms)'),
}).nullable().optional();

/**
 * Schema for query strategy with expansion, filtering, and exclusion groups
 */
export const queryStrategySchema = z.object({
  expansionGroups: z.array(z.array(z.string())).nullable().optional().describe('Groups of terms that expand results (OR groups)'),
  filteringGroups: z.array(z.array(z.string())).nullable().optional().describe('Groups of terms that filter results (AND groups)'),
  exclusionGroups: z.array(z.array(z.string())).nullable().optional().describe('Groups of terms to exclude (NOT groups)'),
  balanceExplanation: z.string().nullable().optional().describe('Explanation of how expansion, filtering, and exclusion are balanced in the query'),
});

/**
 * Schema for alternative queries with use cases
 */
export const alternativeQuerySchema = z.object({
  query: z.string().describe('Alternative boolean query string'),
  useCase: z.string().describe('When to use this query (e.g., "if too many results", "if too few results", "for broader search", "for narrower search")'),
  reasoning: z.string().nullable().optional().describe('Explanation of why this alternative query is useful'),
});

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
  termAnalysis: termAnalysisSchema.describe('Term categorization analysis (expand, filter, essential, optional, exclude)'),
  queryStrategy: queryStrategySchema.nullable().optional().describe('Query strategy with expansion, filtering, and exclusion groups'),
  alternativeQueries: z.array(alternativeQuerySchema).nullable().optional().describe('Array of alternative queries with use cases (e.g., "if too many results", "if too few results")'),
});

export type BooleanQueryBuilderResult = z.infer<typeof booleanQueryBuilderSchema>;
