import { z } from 'zod';

/**
 * First-step router: open-market people search vs employer-scoped (named org + optional division/BU).
 * Downstream: RequirementAnalyzer + Python vs org-chart context + OrgChartIntent + query router.
 */
export const searchIntentRouteSchema = z.object({
  intent: z.enum(['open_market', 'employer_scoped']),
  /**
   * Canonical employer name when intent is employer_scoped (e.g. "Tata Motors", "Google").
   * Must be null when intent is open_market.
   */
  primary_employer_name: z.string().nullable(),
  rationale: z.string().nullable().optional(),
});

export type SearchIntentRoute = z.infer<typeof searchIntentRouteSchema>;
