import { z } from 'zod';

export const strategyExamplesSchema = z.object({
  examples: z.array(z.object({
      strategyType: z.string().describe('Type of strategy (e.g., "Keywords-Only", "Keywords + Location", "Keywords + Location + Company")'),
      exampleQueries: z.array(z.string()).describe('Array of example boolean query strings that can be put in the search bar'),
      description: z.string().nullable().optional().describe('Brief description of this strategy type'),
    })),
  });

export type StrategyExamples = z.infer<typeof strategyExamplesSchema>;