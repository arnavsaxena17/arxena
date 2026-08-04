import { z } from 'zod';

export const SendLinkedinMessageToolInputZodSchema = z.object({
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
  body: z.string().optional().default('').describe('Message body'),
});

export type SendLinkedinMessageToolInput = z.infer<
  typeof SendLinkedinMessageToolInputZodSchema
>;
