import { z } from 'zod';

export const AcceptLinkedinReceivedInvitationToolInputZodSchema = z.object({
  unipileAccountId: z
    .string()
    .min(1)
    .describe('Unipile LinkedIn account ID'),
  linkedinProfileId: z
    .string()
    .optional()
    .default('')
    .describe('Prospect LinkedIn profile id / public identifier / URL'),
  linkedinPublicIdentifier: z
    .string()
    .optional()
    .default('')
    .describe('Prospect LinkedIn public identifier (slug)'),
  providerId: z
    .string()
    .optional()
    .default('')
    .describe('Prospect LinkedIn provider_id (ACo…)'),
  linkedinUrl: z
    .string()
    .optional()
    .default('')
    .describe('Optional LinkedIn profile URL'),
  candidateId: z
    .string()
    .optional()
    .describe('CRM Candidate id for logging / provider cache'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(50)
    .describe('Max received invitations to scan'),
});

export type AcceptLinkedinReceivedInvitationToolInput = z.infer<
  typeof AcceptLinkedinReceivedInvitationToolInputZodSchema
>;
