import { z } from 'zod';

// Mirrors QUALIFY_PROSPECT_SCHEMA on the seeded gtm-outreach-qualify-prospect agent.
export const outreachOpenerHookLlmSchema = z.object({
  source: z.string(),
  quote: z.string(),
  problem: z.string(),
  why_sender: z.string(),
});

export const outreachQualifyProspectLlmSchema = z.object({
  go: z.boolean(),
  score: z.number(),
  segment: z.string(),
  reason: z.string(),
  first_name: z.string(),
  honorific: z.string(),
  company_short: z.string(),
  industry_phrase: z.string(),
  hooks: z.string(),
  likely_systems: z.string(),
  matching_problem_statement: z.string(),
  referral_source: z.string(),
  opener_hook: outreachOpenerHookLlmSchema,
});

export type OutreachQualifyProspectLlmResult = z.infer<
  typeof outreachQualifyProspectLlmSchema
>;
