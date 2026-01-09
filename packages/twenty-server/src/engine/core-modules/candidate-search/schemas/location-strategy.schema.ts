import { z } from 'zod';

/**
 * Location fallback strategy schema
 */
export const locationFallbackStrategySchema = z.object({
  primary: z.string().describe('Primary location'),
  fallbackLocations: z.array(
    z.object({
      location: z.string().describe('Fallback location name'),
      priority: z.number().describe('Priority order (lower number = higher priority)'),
      reasoning: z.string().describe('Why this location is a good fallback'),
      clusterType: z.string().nullable().describe('Type of industrial cluster (e.g., "manufacturing", "IT", "pharma")'),
    }),
  ).describe('Ordered list of fallback locations'),
});

export type LocationFallbackStrategy = z.infer<typeof locationFallbackStrategySchema>;

