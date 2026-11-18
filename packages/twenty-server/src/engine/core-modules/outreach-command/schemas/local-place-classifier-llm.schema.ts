import { z } from 'zod';

export const localPlaceClassifierLlmResultSchema = z.object({
  companyName: z.string().describe('Canonical brand / company name'),
  isMultiOutlet: z
    .boolean()
    .describe(
      'True if this is a multi-outlet brand / chain (not a single independent location)',
    ),
  numberOutlets: z
    .number()
    .int()
    .nonnegative()
    .describe(
      'Estimated number of locations worldwide or in-market if known; 0 if unknown or not a multi-outlet brand',
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence in the classification from 0 to 1'),
  reasoning: z
    .string()
    .describe('One short sentence explaining the outlet-count estimate'),
});

export type LocalPlaceClassifierLlmResult = z.infer<
  typeof localPlaceClassifierLlmResultSchema
>;
