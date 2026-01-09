import { z } from 'zod';

/**
 * Schema for hierarchical search strategy
 * Used for multi-level search expansion (e.g., CEO → COO → Head of Operations)
 */
export const hierarchicalSearchStrategySchema = z.object({
  strategies: z.array(
    z.object({
      level: z.number().describe('Hierarchy level (0 = exact match, 1 = one level down, 2 = two levels down, etc.)'),
      role: z.string().describe('Role to search for at this level (e.g., "CEO", "COO", "Head of Operations")'),
      roleVariations: z.array(z.string()).describe('Role variations and synonyms for this level'),
      industryScope: z.string().describe('Industry scope for this level (e.g., "ceramics insulators", "ceramics", "glass", "allied industries")'),
      priority: z.number().describe('Priority ranking (lower number = higher priority, exact match = 0)'),
      estimatedCandidateCount: z.number().nullable().optional().describe('Estimated number of candidates at this level'),
      reasoning: z.string().describe('Reasoning for this strategy level'),
      stopIfSufficient: z.boolean().describe('Whether to stop searching further levels if sufficient candidates found at this level'),
    })
  ).describe('List of hierarchical search strategies ordered by priority'),
  searchQuery: z.string().describe('The original search query'),
  totalLevels: z.number().describe('Total number of hierarchy levels planned'),
  expansionPath: z.string().describe('Description of the expansion path (e.g., "CEO → COO → Head of Operations, ceramics → glass")'),
});

export type HierarchicalSearchStrategy = z.infer<typeof hierarchicalSearchStrategySchema>;

