import { z } from 'zod';

/**
 * Shared search query shape used by Agent 3 (primary query) and Agent 4 (factored query).
 *
 * Everything after `years_of_experience` is carried, not invented: Agent 1 already
 * extracts it into ParsedRequirement (industry terms, certifications, company type,
 * years, exclusions) and the query set used to drop it on the floor. The fields are
 * optional and nullable so an older producer that omits them still validates.
 */
export const searchQuerySchema = z.object({
  keywords: z.string().nullable(),
  job_title: z.string().nullable(),
  company: z.array(z.string()).nullable(),
  location: z.array(z.string()).nullable(),
  years_of_experience: z.string().nullable(),
  industry_terms: z.array(z.string()).optional().nullable(),
  certifications: z.array(z.string()).optional().nullable(),
  company_type: z
    .enum([
      'public_company',
      'privately_held',
      'non_profit',
      'educational_institution',
      'partnership',
      'self_employed',
      'self_owned',
      'government_agency',
    ])
    .optional()
    .nullable(),
  company_type_raw: z.string().optional().nullable(),
  seniority: z
    .enum([
      'owner/partner',
      'cxo',
      'vice_president',
      'director',
      'experienced_manager',
      'entry_level_manager',
      'strategic',
      'senior',
      'entry_level',
      'in_training',
    ])
    .optional()
    .nullable(),
  function: z.string().optional().nullable(),
  years_min: z.number().optional().nullable(),
  years_max: z.number().optional().nullable(),
  exclude_companies: z.array(z.string()).optional().nullable(),
  exclude_industries: z.array(z.string()).optional().nullable(),
  exclude_locations: z.array(z.string()).optional().nullable(),
});

/**
 * Term counts for keywords, job_title, and combined (for splitting decisions).
 */
export const termCountsSchema = z.object({
  keywords: z.number(),
  job_title: z.number(),
  combined: z.number(),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type TermCounts = z.infer<typeof termCountsSchema>;
