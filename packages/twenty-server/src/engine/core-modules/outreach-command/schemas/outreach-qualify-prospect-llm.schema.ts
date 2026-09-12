import { z } from 'zod';

// Mirrors QUALIFY_PROSPECT_SCHEMA on the seeded gtm-outreach-qualify-prospect agent.
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
});

export type OutreachQualifyProspectLlmResult = z.infer<
  typeof outreachQualifyProspectLlmSchema
>;

export const OUTREACH_QUALIFY_PROSPECT_SYSTEM_PROMPT =
  'You decide whether to contact a prospect for the sender offer and extract personalization hooks. Return JSON only: { "go", "score", "segment", "reason", "first_name", "honorific", "company_short", "industry_phrase", "hooks", "likely_systems", "matching_problem_statement", "referral_source" }. hooks is a JSON string of at most 3 { "text", "source" } objects. Never invent facts.';
