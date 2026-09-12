import { z } from 'zod';

export const FetchLinkedinActivityToolInputZodSchema = z.object({
  unipileAccountId: z
    .string()
    .min(1)
    .describe('Unipile LinkedIn account ID to fetch from'),
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
    .describe('CRM Candidate id used to resolve/cache the Unipile provider id'),
  postsLimit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(10)
    .describe('Max posts to return (1-100)'),
  includeUserComments: z
    .boolean()
    .optional()
    .default(true)
    .describe('Also fetch comments written by this user'),
  userCommentsLimit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(10)
    .describe('Max user comments to return when includeUserComments is true'),
});

export type FetchLinkedinActivityToolInput = z.infer<
  typeof FetchLinkedinActivityToolInputZodSchema
>;
