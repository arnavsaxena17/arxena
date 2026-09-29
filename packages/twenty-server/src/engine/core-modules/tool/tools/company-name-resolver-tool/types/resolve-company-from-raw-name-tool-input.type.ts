import { z } from 'zod';

export const ResolveCompanyFromRawNameToolInputZodSchema = z
  .object({
    companyName: z
      .string()
      .optional()
      .default('')
      .describe('Single raw company name to resolve'),
    companyNames: z
      .array(z.string())
      .optional()
      .default([])
      .describe('Batch of raw company names to resolve (max 50)'),
  })
  .refine(
    (input) =>
      (typeof input.companyName === 'string' &&
        input.companyName.trim().length > 0) ||
      (Array.isArray(input.companyNames) &&
        input.companyNames.some((name) => name.trim().length > 0)),
    {
      message: 'companyName or companyNames is required',
    },
  );

export type ResolveCompanyFromRawNameToolInput = z.infer<
  typeof ResolveCompanyFromRawNameToolInputZodSchema
>;
