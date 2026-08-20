import { z } from 'zod';

export const SendWhatsappMessageToolInputZodSchema = z.object({
  unipileAccountId: z
    .string()
    .min(1)
    .describe('Unipile WhatsApp account ID to send from'),
  phone: z.string().min(1).describe('Recipient phone number'),
  body: z.string().optional().default('').describe('Message body'),
  candidateId: z
    .string()
    .optional()
    .describe('CRM Candidate id for transcript persist'),
});

export type SendWhatsappMessageToolInput = z.infer<
  typeof SendWhatsappMessageToolInputZodSchema
>;
