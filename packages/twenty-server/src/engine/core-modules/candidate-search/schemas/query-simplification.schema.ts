import { z, ZodTypeAny } from 'zod';

/**
 * Simplification strategies that can be applied to reduce query complexity
 */
export const simplificationStrategyEnum = z.enum([
  'remove_location',
  'reduce_keywords',
  'remove_company_from_keywords',
  'remove_company_filter',
  'simplify_boolean',
  'combine',
]);

export type SimplificationStrategy = z.infer<typeof simplificationStrategyEnum>;

/**
 * Schema for query simplification response
 * This defines how a failed query should be simplified for retry
 * Note: simplifiedParameters uses z.any() here for flexibility, but should be replaced
 * with the specific search schema when creating the wrapper schema in the service
 */
export const querySimplificationSchema = z.object({
  simplifiedParameters: z.any().describe('Simplified search parameters in the same structure as the original (e.g., classicPeopleSearch, salesNavigatorPeopleSearch, etc.)'),
  strategy: simplificationStrategyEnum.describe('The simplification strategy that was applied'),
  modifications: z.array(z.string()).describe('List of specific changes made to simplify the query (e.g., "Removed location filter", "Reduced keywords from 8 to 6 terms")'),
  reasoning: z.string().describe('Explanation of why this simplification was chosen and how it reduces query complexity while preserving search intent'),
  estimatedComplexity: z.enum(['high', 'medium', 'low']).describe('Estimated complexity level after simplification'),
  keywordsTermCount: z.number().nullable().describe('Number of keyword terms in the simplified keywords string (for classic search, must be <= 6)'),
});

/**
 * Creates a type-safe query simplification schema with the correct simplifiedParameters type
 * @param searchSchema The specific search schema to use for simplifiedParameters
 * @returns A properly typed query simplification schema
 */
export function createQuerySimplificationSchema<T extends ZodTypeAny>(searchSchema: T) {
  return z.object({
    simplifiedParameters: searchSchema.describe('Simplified search parameters matching the specific search type'),
    strategy: simplificationStrategyEnum.describe('The simplification strategy that was applied'),
    modifications: z.array(z.string()).describe('List of specific changes made to simplify the query (e.g., "Removed location filter", "Reduced keywords from 8 to 6 terms")'),
    reasoning: z.string().describe('Explanation of why this simplification was chosen and how it reduces query complexity while preserving search intent'),
    estimatedComplexity: z.enum(['high', 'medium', 'low']).describe('Estimated complexity level after simplification'),
    keywordsTermCount: z.number().nullable().describe('Number of keyword terms in the simplified keywords string (for classic search, must be <= 6)'),
  });
}

export type QuerySimplification = z.infer<typeof querySimplificationSchema>;

