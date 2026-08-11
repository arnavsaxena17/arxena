import { z } from 'zod';

export const gtmWebSearchCompanyLlmResultSchema = z.object({
  companyName: z.string(),
  websiteUrl: z.string().optional().default(''),
  summary: z.string(),
  productsOrServices: z.array(z.string()).optional().default([]),
  industry: z.string().optional().default(''),
  hq: z.string().optional().default(''),
  employeeHint: z.string().optional().default(''),
  keyFacts: z.array(z.string()).optional().default([]),
  sourceUrls: z.array(z.string()).optional().default([]),
  notes: z.string().optional().default(''),
});

export type GtmWebSearchCompanyLlmResult = z.infer<
  typeof gtmWebSearchCompanyLlmResultSchema
>;
