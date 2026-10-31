import { z } from 'zod';

export const WriteLinkedinUrlToolInputZodSchema = z.object({
  projectId: z
    .string()
    .optional()
    .describe('Project id; defaults to the project the user is looking at'),
  personId: z
    .string()
    .min(1)
    .describe('People-tab row id (the ephemeral row id from get_outreach_tab)'),
  linkedinUrl: z
    .string()
    .min(1)
    .max(500)
    .describe('Resolved LinkedIn profile URL, e.g. https://www.linkedin.com/in/…'),
  relation: z
    .enum(['current', 'past', 'unknown'])
    .default('unknown')
    .describe(
      'Whether the profile holds the role at the company now, held it before, or the company was not confirmed',
    ),
  evidence: z
    .string()
    .max(1000)
    .optional()
    .describe('The words that justify the match, from resolve_linkedin_url'),
  source: z
    .enum(['bright_data', 'google'])
    .optional()
    .describe('Which resolver source produced the URL'),
});

export type WriteLinkedinUrlToolInput = z.infer<
  typeof WriteLinkedinUrlToolInputZodSchema
>;
