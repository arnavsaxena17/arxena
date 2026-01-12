import { z } from 'zod';
import { companySizeRangeSchema } from './query-understanding.schema';

/**
 * Org structure schema for organizational chart mapping
 */
export const orgStructureSchema = z.object({
  reportingTo: z.string().nullable().describe('Who this role reports to (e.g., "CEO", "MD", "VP Operations")'),
  manages: z.array(z.string()).describe('Roles that report to this position'),
  level: z.number().describe('Hierarchy level (0 = CEO, 1 = C-suite, 2 = VP, 3 = Director, etc.)'),
  equivalentRoles: z.array(z.string()).describe('Equivalent roles at different company sizes'),
  companySizeContext: companySizeRangeSchema.describe('Company size range this structure applies to'),
});

export type OrgStructure = z.infer<typeof orgStructureSchema>;


