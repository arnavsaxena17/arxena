import { z } from 'zod';

export const SendLinkedinConnectionRequestToolInputZodSchema = z.object({
  unipileAccountId: z
    .string()
    .min(1)
    .describe('Unipile LinkedIn account ID to send from'),
  linkedinProfileId: z
    .string()
    .min(1)
    .describe(
      'LinkedIn profile ID, public identifier, or LinkedIn profile URL',
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
