import { z } from 'zod';

/**
 * Company profile shaped for ICP extraction when LinkedIn Unipile data is
 * unavailable and we fall back to LLM web search.
 */
export const companyWebsearchLlmResultSchema = z.object({
  name: z.string(),
  description: z.string(),
  industry: z.string().optional().default(''),
  employee_count: z.union([z.string(), z.number()]).optional().nullable(),
  website: z.string().optional().nullable(),
  headquarters: z.string().optional().nullable(),
  products_services: z.string().optional().nullable(),
  linkedin_url: z.string().optional().nullable(),
  notes: z.string().optional().default(''),
});

export type CompanyWebsearchLlmResult = z.infer<
  typeof companyWebsearchLlmResultSchema
>;
