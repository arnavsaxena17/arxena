import { type EmailAttachment } from 'twenty-shared/types';
import { workflowFileSchema } from 'twenty-shared/workflow';
import { z } from 'zod';

export const SendLinkedinVoiceNoteToolInputZodSchema = z.object({
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
  body: z
    .string()
    .optional()
    .default('')
    .describe('Optional caption; may be empty for voice-only'),
  files: z
    .array(workflowFileSchema)
    .describe('Exactly one audio file (.m4a preferred) for the voice note')
    .optional()
    .default([]),
  candidateId: z
    .string()
    .optional()
    .describe('Optional CRM Candidate id for provider_id caching'),
});

export type SendLinkedinVoiceNoteToolInput = z.infer<
  typeof SendLinkedinVoiceNoteToolInputZodSchema
> & {
  files?: EmailAttachment[];
};
