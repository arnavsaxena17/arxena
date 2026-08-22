import { z } from 'zod';

export const gtmCompanyProfileLlmResultSchema = z.object({
  companyName: z.string(),
  industry: z.string(),
  summary: z.string(),
  employeeRange: z.string(),
  hq: z.string(),
  notes: z.string(),
});

export type GtmCompanyProfileLlmResult = z.infer<
  typeof gtmCompanyProfileLlmResultSchema
>;
