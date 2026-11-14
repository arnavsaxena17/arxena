import { z } from 'zod';

/**
 * Zod schema for result validation
 */
export const resultValidationSchema = z.object({
  isRelevant: z.boolean().describe('Whether the results are relevant to the query'),
  relevanceScore: z.number().min(0).max(1).describe('Overall relevance score from 0 to 1'),
  falsePositives: z.array(z.string()).describe('List of false positive examples found (e.g., "EA to Sales Head" when searching for "Sales Head")'),
  qualityAssessment: z.enum(['high', 'medium', 'low']).describe('Overall quality assessment of the results'),
  shouldContinuePagination: z.boolean().describe('Whether to continue fetching more pages based on result quality and relevance'),
  reasoning: z.string().describe('Explanation for the validation decision'),
});

