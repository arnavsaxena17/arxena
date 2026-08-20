import { z } from 'zod';

export const SendLinkedinInmailToolInputZodSchema = z.object({
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
  subject: z.string().optional().default('').describe('InMail subject'),
  body: z.string().optional().default('').describe('InMail body'),
  candidateId: z
    .string()
    .optional()
    .describe('CRM Candidate id for transcript persist'),
});

export type SendLinkedinInmailToolInput = z.infer<
  typeof SendLinkedinInmailToolInputZodSchema
>;
