import { z } from 'zod';

const requirementSchema = z.object({
  raw_input: z.string().describe('The original user or system input requesting a search or schema.'),
  interpreted_role_category: z.string().describe('The interpreted high-level category of the job or role.'),
  industry_context: z.string().describe('The industry context as interpreted from the requirement.'),
  mandatory_elements: z.array(z.string()).describe('List of elements that must be present in search results.'),
  optional_elements: z.array(z.string()).describe('List of desirable, but not strictly necessary, elements.'),
}).strict();

const jobTitlesSchema = z.object({
  core_titles: z.array(z.string()).describe('Canonical/primary job titles representing the search intent.'),
  equivalent_titles: z.array(z.string()).describe('Alternate job titles considered equivalent.'),
  senior_variants: z.array(z.string()).describe('Titles reflecting senior-level variations.'),
  mid_level_variants: z.array(z.string()).describe('Titles reflecting mid-level variations.'),
  alternate_spellings: z.array(z.string()).describe('Alternate spellings or abbreviations for the titles.'),
}).strict();

const keywordExpansionSchema = z.object({
  job_titles: jobTitlesSchema,
  industry_terms: z.array(z.string()).describe('Industry-specific search terms.'),
  skills_keywords: z.array(z.string()).describe('Skills-specific keywords for matching roles.'),
  excluded_terms: z.array(z.string()).describe('List of terms to explicitly exclude from search.'),
}).strict();

const booleanComponentsSchema = z.object({
  job_title_block: z.string().describe('Boolean search block for job titles.'),
  industry_block: z.string().describe('Boolean search block for industry context.'),
  skills_block: z.string().describe('Boolean search block for skills.'),
  mandatory_block: z.string().describe('Boolean string for mandatory requirements.'),
  location_block: z.string().describe('Boolean string for location-based filtering.'),
  final_boolean_string: z.string().describe('Full final boolean string synthesized from the above.'),
}).strict();

export const booleanQueryResponseSchema = z.object({
  requirement: requirementSchema,
  keyword_expansion: keywordExpansionSchema,
  boolean_components: booleanComponentsSchema,
}).strict();
