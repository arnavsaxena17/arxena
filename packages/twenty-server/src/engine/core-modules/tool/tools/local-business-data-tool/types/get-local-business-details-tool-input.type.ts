import { z } from 'zod';

export const GetLocalBusinessDetailsToolInputZodSchema = z.object({
  businessIds: z
    .array(z.string())
    .min(1)
    .max(20)
    .describe('Business ids (business_id, google_id, or place_id), up to 20'),
  extractEmailsAndContacts: z.boolean().optional().default(true),
  extractShareLink: z.boolean().optional().default(false),
  language: z.string().optional().default('en'),
  region: z.string().optional().default('us'),
  fields: z.string().optional(),
});

export type GetLocalBusinessDetailsToolInput = z.infer<
  typeof GetLocalBusinessDetailsToolInputZodSchema
>;
