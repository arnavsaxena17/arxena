import { z } from 'zod';

export const FollowLinkedinProfileToolInputZodSchema = z.object({
  unipileAccountId: z
    .string()
    .min(1)
    .describe('Unipile LinkedIn account ID to follow from'),
  linkedinProfileId: z
    .string()
    .optional()
    .default('')
    .describe(
      'LinkedIn profile ID, public identifier, or LinkedIn profile URL',
    ),
  linkedinUrl: z
    .string()
    .optional()
    .default('')
    .describe(
      'Optional LinkedIn profile URL if linkedinProfileId is empty or is a URL/composite',
    ),
  candidateId: z
    .string()
    .optional()
    .describe('Optional CRM Candidate id for provider_id caching'),
});

export type FollowLinkedinProfileToolInput = z.infer<
  typeof FollowLinkedinProfileToolInputZodSchema
>;
