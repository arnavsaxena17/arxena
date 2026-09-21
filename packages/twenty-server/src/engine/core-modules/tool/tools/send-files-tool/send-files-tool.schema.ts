import { z } from 'zod';

export const SendFilesToolInputZodSchema = z.object({
  channel: z
    .enum(['linkedin', 'email', 'whatsapp'])
    .describe('Delivery channel for the configured file(s)'),
  text: z
    .string()
    .optional()
    .describe('Optional message body to send with the file(s)'),
  candidateId: z
    .string()
    .uuid()
    .optional()
    .describe('Candidate id when available (used for LinkedIn provider resolve)'),
  workspaceMemberId: z
    .string()
    .uuid()
    .optional()
    .describe(
      'Workspace member id for sender_collateral file resolution when not in tool config',
    ),
  // LinkedIn
  unipileAccountId: z
    .string()
    .optional()
    .describe('Unipile LinkedIn account id (required for linkedin channel)'),
  linkedinProfileId: z
    .string()
    .optional()
    .describe('Recipient LinkedIn provider id or public identifier'),
  linkedinUrl: z
    .string()
    .optional()
    .describe('Recipient LinkedIn profile URL (alternative to profile id)'),
  // Email
  to: z
    .string()
    .optional()
    .describe('Recipient email address (required for email channel)'),
  subject: z
    .string()
    .optional()
    .describe('Email subject (defaults to "Shared file")'),
  connectedAccountId: z
    .string()
    .uuid()
    .optional()
    .describe('Connected account UUID to send email from'),
  // WhatsApp
  phone: z
    .string()
    .optional()
    .describe('Recipient phone number (required for whatsapp channel)'),
  whatsappUnipileAccountId: z
    .string()
    .optional()
    .describe('Unipile WhatsApp account id (required for whatsapp channel)'),
});

export type SendFilesToolInput = z.infer<typeof SendFilesToolInputZodSchema>;
