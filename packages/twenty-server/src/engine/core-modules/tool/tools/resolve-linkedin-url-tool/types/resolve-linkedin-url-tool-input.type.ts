import { z } from 'zod';

export const ResolveLinkedinUrlToolInputZodSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(200)
    .describe('Full name as written, e.g. "Suresh N" or "Veeramani M P"'),
  company: z
    .string()
    .min(1)
    .max(200)
    .describe('Company the person is being resolved at, as the row states it'),
  alternateCompanies: z
    .array(z.string().min(1).max(200))
    .max(5)
    .optional()
    .default([])
    .describe(
      'Other names the company goes by (legal name, brand, parent). One lookup runs per name.',
    ),
  title: z
    .string()
    .max(200)
    .optional()
    .describe(
      'Role the person holds, e.g. "Purchase Lead". Used to disambiguate a common name.',
    ),
});

export type ResolveLinkedinUrlToolInput = z.infer<
  typeof ResolveLinkedinUrlToolInputZodSchema
>;
