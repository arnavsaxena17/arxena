import { z } from 'zod';

const bySenioritySchema = z.object({
  junior: z.array(z.string()).optional(),
  mid: z.array(z.string()).optional(),
  senior: z.array(z.string()).optional(),
  cxo: z.array(z.string()).optional(),
});

/** Array form for grouped concepts (z.record not supported by OpenAI zodResponseFormat). */
const groupedConceptEntrySchema = z.object({
  concept: z.string().describe('Concept or key name'),
  terms: z.array(z.string()).describe('Synonyms/related terms'),
});

const keywordsMasterSchema = z.object({
  all_terms: z.array(z.string()).describe('Exhaustive list of keyword terms'),
  grouped_concepts: z
    .array(groupedConceptEntrySchema)
    .describe('Concept key to synonyms/related terms'),
  selected_terms: z.array(z.string()).describe('Selected terms (match all_terms when expanded)'),
  term_count: z.number().describe('Number of terms in all_terms'),
});

const jobTitlesMasterSchema = z.object({
  all_terms: z.array(z.string()).describe('Exhaustive list of job title variants'),
  by_seniority: bySenioritySchema.describe('Titles grouped by seniority band'),
  selected_terms: z.array(z.string()).describe('Selected terms (match all_terms when expanded)'),
  term_count: z.number().describe('Number of terms in all_terms'),
});

const companiesMasterSchema = z.object({
  all_companies: z.array(z.string()).describe('List of companies'),
  use_company_filter: z.boolean().describe('Use company filter vs alternative_keywords'),
  reasoning: z.string().describe('Explanation for company strategy'),
  alternative_keywords: z.array(z.string()).optional(),
  clusters: z.array(z.array(z.string())).optional().describe('Company clusters for splitting'),
});

/**
 * Agent 2 (Master Lists): keywords, job_titles, and companies master lists.
 */
export const agent2MasterListsSchema = z.object({
  keywords: keywordsMasterSchema,
  job_titles: jobTitlesMasterSchema,
  companies: companiesMasterSchema,
});

export type Agent2MasterListsResult = z.infer<typeof agent2MasterListsSchema>;
