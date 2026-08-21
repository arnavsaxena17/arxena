import { type EmailAttachment } from 'twenty-shared/types';
import { workflowFileSchema } from 'twenty-shared/workflow';
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
  files: z
    .array(workflowFileSchema)
    .describe(
      'Files to attach to the LinkedIn message (PDF, image, or video, max 15MB)',
    )
    .optional()
    .default([]),
  candidateId: z
    .string()
    .optional()
    .describe('CRM Candidate id for transcript persist'),
});

export type SendLinkedinMessageToolInput = Omit<
  z.infer<typeof SendLinkedinMessageToolInputZodSchema>,
  'files'
> & {
  files?: EmailAttachment[];
};
