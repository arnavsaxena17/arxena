import { z } from 'zod';

export const SendLinkedinConnectionRequestToolInputZodSchema = z.object({
  unipileAccountId: z
    .string()
    .min(1)
    .describe('Unipile LinkedIn account ID to send from'),
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
  message: z
    .string()
    .optional()
    .default('')
    .describe('Optional connection request note (max 300 characters)'),
});

export type SendLinkedinConnectionRequestToolInput = z.infer<
  typeof SendLinkedinConnectionRequestToolInputZodSchema
>;
