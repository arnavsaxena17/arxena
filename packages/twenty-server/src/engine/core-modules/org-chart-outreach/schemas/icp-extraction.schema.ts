import { z } from 'zod';

export const icpProfileSchema = z.object({
  industry: z
    .array(z.string())
    .describe('Industries the lead\'s company should be selling into'),
  employee_range: z
    .string()
    .describe('Target company size range, e.g. "200-2000"'),
  tech_stack_signals: z
    .array(z.string())
    .describe('Technologies a good target company would be running'),
  buyer_titles: z
    .array(z.string())
    .describe('Project titles of the buyer / economic buyer at a target company'),
  pain_signals: z
    .array(z.string())
    .describe('Observable signals that a target company has the pain this lead\'s product solves'),
});

/** Prompt 1 output — screen the lead + extract the ICP their company sells to. */
export const icpExtractionLlmResultSchema = z.object({
  sells: z
    .string()
    .min(1)
    .describe('What the lead\'s company actually sells (product, category)'),
  relevant_recipient_for_target_account_lure: z
    .boolean()
    .describe('Whether a target-account org chart lure would land on this specific person'),
  reasoning: z
    .string()
    .min(1)
    .describe('Must justify the true/false call from the screening signals, not just restate the title'),
  icp: icpProfileSchema,
  chart_function: z
    .string()
    .nullable()
    .describe('Function/team at a target company the org chart should focus on; null when the lure is not relevant'),
});

export const rankedIcpCandidateSchema = z.object({
  company_name: z.string().min(1),
  fit_reasoning: z
    .string()
    .min(1)
    .describe('Must reference the specific matching ICP signal(s), not a generic restatement'),
  chart_function: z.string().min(1),
});

/** Prompt 2 output — rank real candidate companies against the ICP. */
export const icpCandidateRankingLlmResultSchema = z.object({
  proceed: z.boolean(),
  reason: z.string().optional(),
  ranked_candidates: z.array(rankedIcpCandidateSchema).max(3).default([]),
});

export type IcpProfile = z.infer<typeof icpProfileSchema>;
export type IcpExtractionLlmResult = z.infer<typeof icpExtractionLlmResultSchema>;
export type RankedIcpCandidate = z.infer<typeof rankedIcpCandidateSchema>;
export type IcpCandidateRankingLlmResult = z.infer<
  typeof icpCandidateRankingLlmResultSchema
>;
