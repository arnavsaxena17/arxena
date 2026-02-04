import { z } from 'zod';

/**
 * Single company name variation entry.
 * Uses array format instead of z.record() because OpenAI structured output
 * does not support record/dynamic keys (additionalProperties).
 */
export const nameVariationEntrySchema = z.object({
  company_key: z.string().describe('Canonical company name e.g. PwC, HUL'),
  variations: z.array(z.string()).describe('All name variations including abbreviations and full names'),
});

/**
 * Company lists with primary, extended, and name variations (Agent 3 output)
 */
export const companyListsSchema = z.object({
  primary: z.array(z.string()).describe('Primary tier company names'),
  extended: z.array(z.string()).describe('Extended tier company names'),
  name_variations: z
    .array(nameVariationEntrySchema)
    .describe('Map of company name to variations (e.g. PwC -> [PwC, PricewaterhouseCoopers])'),
});

/**
 * Company analysis from Agent 3 (Company Expander)
 */
export const companyExpanderSchema = z.object({
  company_strategy: z.string().describe('e.g. critical, important_secondary, optional_secondary, critical_primary'),
  reasoning: z.string().nullable().describe('Why this strategy was chosen'),
  company_lists: companyListsSchema.describe('Tiered company lists and name variations'),
  use_company_filter: z.boolean().describe('Whether to use company filter in search'),
  company_filter_priority: z.string().nullable().describe('primary, secondary, or optional'),
});

export type CompanyExpanderResult = z.infer<typeof companyExpanderSchema>;
export type CompanyLists = z.infer<typeof companyListsSchema>;
export type NameVariationEntry = z.infer<typeof nameVariationEntrySchema>;

/**
 * Default result when requirement does not require company targeting (keyword/job-title search sufficient).
 * Use in multi-agent flow to skip the company expander.
 */
export const NO_COMPANY_TARGETING_RESULT: CompanyExpanderResult = {
  company_strategy: 'none',
  reasoning: 'Requirement does not specify a company category; keyword and job title search sufficient.',
  company_lists: {
    primary: [],
    extended: [],
    name_variations: [],
  },
  use_company_filter: false,
  company_filter_priority: null,
};
