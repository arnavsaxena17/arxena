import { z } from 'zod';

export const gtmWebSearchCompanyLlmResultSchema = z.object({
  companyName: z.string(),
  websiteUrl: z.string(),
  summary: z.string(),
  productsOrServices: z.array(z.string()),
  industry: z.string(),
  hq: z.string(),
  employeeHint: z.string(),
  keyFacts: z.array(z.string()),
  sourceUrls: z.array(z.string()),
  notes: z.string(),
});

export type GtmWebSearchCompanyLlmResult = z.infer<
  typeof gtmWebSearchCompanyLlmResultSchema
>;
