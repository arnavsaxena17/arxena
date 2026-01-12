import { z } from 'zod';

/**
 * Executive validation schema
 */
export const executiveValidationSchema = z.object({
  orgStructureFitment: z.object({
    match: z.boolean(),
    score: z.number(),
    reasoning: z.string(),
  }),
  cultureMatch: z.object({
    match: z.boolean(),
    score: z.number(),
    reasoning: z.string(),
  }),
  reportingEquivalence: z.object({
    match: z.boolean(),
    score: z.number(),
    reasoning: z.string(),
  }),
});

export type ExecutiveValidation = z.infer<typeof executiveValidationSchema>;


