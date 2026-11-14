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

export const LOCAL_PLACE_CLASSIFIER_JSON_SCHEMA = {
  type: 'object' as const,
  properties: {
    companyName: {
      type: 'string' as const,
      description: 'Canonical brand / company name',
    },
    isMultiOutlet: {
      type: 'boolean' as const,
      description: 'True if multi-outlet brand / chain',
    },
    numberOutlets: {
      type: 'integer' as const,
      description: 'Estimated outlet count; 0 if unknown or not a chain',
    },
    confidence: {
      type: 'number' as const,
      description: 'Confidence 0–1',
    },
    reasoning: {
      type: 'string' as const,
      description: 'One short sentence',
    },
  },
  required: [
    'companyName',
    'isMultiOutlet',
    'numberOutlets',
    'confidence',
    'reasoning',
  ],
  additionalProperties: false as const,
};
