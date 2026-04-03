import { z } from 'zod';

/**
 * Structured LLM output for mapping a natural-language business division
 * request to LinkedIn classic people search keywords and optional org-chart filters.
 */
export const businessDivisionOrgChartParsedSchema = z.object({
  linkedin_keywords: z
    .string()
    .describe(
      'LinkedIn boolean-style keyword string for classic people search: use AND / OR / parentheses. Max ~6 OR terms per parenthetical group. Prefer short synonyms (e.g. PU OR polyurethane).',
    ),
  country: z
    .string()
    .nullable()
    .describe(
      'Country name if explicitly mentioned in the user text; otherwise null to use UI default.',
    ),
  function_root: z
    .string()
    .nullable()
    .describe(
      'Org-chart function root (e.g. engineering, sales) if clearly implied; otherwise null to use UI default / full company.',
    ),
  rationale: z
    .string()
    .optional()
    .describe('Brief internal note for logs (optional).'),
});

export type BusinessDivisionOrgChartParsed = z.infer<
  typeof businessDivisionOrgChartParsedSchema
>;
