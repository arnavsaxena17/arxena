import { z } from 'zod';

// Every section is a flag. Defaults live in the drafter, so an omitted flag
// and an omitted include object behave the same.
const includeSchema = z.object({
  senderProfile: z
    .boolean()
    .optional()
    .describe(
      "Sender profile (the candidate's assigned member, else the workspace operator). Default true.",
    ),
  prospectEnrichment: z
    .boolean()
    .optional()
    .describe(
      'Qualify-stamped enrichment on enrolled candidates. Default true.',
    ),
  profile: z
    .boolean()
    .optional()
    .describe(
      'Live LinkedIn profile fetch, one Unipile call per row. Default true.',
    ),
  posts: z
    .boolean()
    .optional()
    .describe(
      'Prospect LinkedIn posts cached on the person (enrolled rows only, no live call). Default true.',
    ),
  chatHistory: z
    .boolean()
    .optional()
    .describe('LinkedIn chat transcript (enrolled rows only). Default true.'),
  companyNews: z
    .boolean()
    .optional()
    .describe(
      "Recent news about the prospect's company: cached 30 days per company, else one web-search LLM call. Default false.",
    ),
});

export const PreviewSampleMessageColumnInputZodSchema = z.object({
  projectId: z
    .string()
    .describe('Project id from the outreachCommand browsing context'),
  include: includeSchema
    .optional()
    .describe(
      'Which context sections feed each draft. Omit for the defaults: everything except companyNews.',
    ),
  rowLimit: z
    .number()
    .int()
    .min(1)
    .max(5)
    .default(3)
    .describe(
      'Rows to draft in the preview (max 5: each row can cost a live profile fetch).',
    ),
});

export type PreviewSampleMessageColumnInput = z.infer<
  typeof PreviewSampleMessageColumnInputZodSchema
>;
