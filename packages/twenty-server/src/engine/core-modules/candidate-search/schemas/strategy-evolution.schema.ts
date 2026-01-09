import { z } from 'zod';

/**
 * Strategy failure analysis schema
 */
export const strategyFailureAnalysisSchema = z.object({
  failedStrategies: z.array(z.string()).describe('List of strategy IDs that failed'),
  failureReasons: z.array(z.string()).describe('Reasons why strategies failed'),
  suggestedImprovements: z.array(z.string()).describe('Suggested improvements for strategies'),
  alternativeApproaches: z.array(
    z.object({
      approach: z.string().describe('Alternative approach description'),
      reasoning: z.string().describe('Why this approach might work'),
      estimatedSuccess: z.number().min(0).max(1).describe('Estimated success probability'),
    }),
  ).describe('Alternative approaches to try'),
});

export type StrategyFailureAnalysis = z.infer<typeof strategyFailureAnalysisSchema>;

