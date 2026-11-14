import { z } from 'zod';

export const ORGCHART_UNIPILE_SHARD_DIMENSIONS = [
  'city',
  'country',
  'region',
  'function',
  'seniority',
  'titleFamily',
] as const;

export type OrgchartUnipileShardDimension =
  (typeof ORGCHART_UNIPILE_SHARD_DIMENSIONS)[number];

export const orgchartUnipileShardPlanShardSchema = z.object({
  key: z
    .string()
    .describe('Short snake_case id, e.g. mumbai or us or remaining'),
  priority: z
    .number()
    .int()
    .min(1)
    .describe('1 = fetch first; higher = later / lower priority'),
  includeLabels: z
    .array(z.string())
    .describe(
      'Human labels to include for this shard (city/country/region names, function names, title phrases). Empty when remaining is true.',
    ),
  remaining: z
    .boolean()
    .describe(
      'True for the catch-all shard: everything else on primaryDimension (code builds excludes from sibling includes).',
    ),
});

export const orgchartUnipileShardPlanLlmSchema = z.object({
  intentSummary: z
    .string()
    .describe('One sentence on how this company workforce is distributed'),
  primaryDimension: z.enum(ORGCHART_UNIPILE_SHARD_DIMENSIONS),
  rationale: z
    .string()
    .describe('Why this dimension splits this company under the 2500 ceiling'),
  shards: z
    .array(orgchartUnipileShardPlanShardSchema)
    .min(2)
    .max(12)
    .describe(
      '2–12 MECE include slices plus exactly one remaining:true shard',
    ),
});

export type OrgchartUnipileShardPlanLlmOutput = z.infer<
  typeof orgchartUnipileShardPlanLlmSchema
>;

export type OrgchartUnipileShardPlanShard = z.infer<
  typeof orgchartUnipileShardPlanShardSchema
>;
