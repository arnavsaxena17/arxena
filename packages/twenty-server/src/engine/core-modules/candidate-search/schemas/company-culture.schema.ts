import { z } from 'zod';

/**
 * Company culture schema
 */
export const companyCultureSchema = z.object({
  cultureType: z.enum(['promoter_driven', 'family_run', 'mnc', 'startup', 'psu', 'pe_backed', 'listed']),
  confidence: z.number().min(0).max(1),
  indicators: z.array(z.string()),
  similarCompanies: z.array(z.string()),
});

export type CompanyCulture = z.infer<typeof companyCultureSchema>;

