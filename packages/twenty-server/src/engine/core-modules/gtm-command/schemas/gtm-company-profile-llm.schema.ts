import { z } from 'zod';

export const gtmCompanyProfileLlmResultSchema = z.object({
  companyName: z.string(),
  industry: z.string().optional().default(''),
  summary: z.string(),
  employeeRange: z.string().optional().default(''),
  hq: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

export type GtmCompanyProfileLlmResult = z.infer<
  typeof gtmCompanyProfileLlmResultSchema
>;
