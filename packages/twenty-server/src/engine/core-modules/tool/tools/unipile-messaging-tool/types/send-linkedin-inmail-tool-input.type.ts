import { z } from 'zod';

export const SendLinkedinInmailToolInputZodSchema = z.object({
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
