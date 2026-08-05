import { z } from 'zod';

const queryTypeSchema = z.enum(['A', 'B', 'C', 'D']);
const precisionVsRecallSchema = z.enum([
  'high_precision',
  'high_recall',
  'balanced',
]);

/**
 * Agent 1 (Parser): structured output from parsing and classifying a recruitment requirement.
 */
export const agent1ParserSchema = z.object({
  original_requirement: z.string().describe('Original requirement text'),
  query_type: queryTypeSchema.describe('Query type A, B, C, or D'),
  query_type_description: z
    .string()
    .describe('Brief explanation of why this type was chosen'),
  // Nullable (not optional): OpenAI strict json_schema requires every key in required
  position_title: z.string().nullable(),
  seniority_level: z.string().nullable(),
  domain_expertise: z.array(z.string()).describe('Domain/industry knowledge areas'),
  technical_skills: z.array(z.string()).describe('Specific skills'),
  industry_terms: z.array(z.string()).describe('Industry jargon and terms'),
  certifications: z.array(z.string()).describe('Certifications mentioned'),
  target_companies: z.array(z.string()).describe('Companies mentioned'),
  company_type: z.string().nullable(),
  location: z.array(z.string()).describe('Location mentions'),
  experience_range: z.string().nullable(),
  years_min: z.number().nullable(),
  years_max: z.number().nullable(),
  salary_range: z.string().nullable(),
  age_range: z.string().nullable(),
  special_notes: z.string().nullable(),
  precision_vs_recall: precisionVsRecallSchema.describe(
    'high_precision | high_recall | balanced',
  ),
});

export type Agent1ParserResult = z.infer<typeof agent1ParserSchema>;
