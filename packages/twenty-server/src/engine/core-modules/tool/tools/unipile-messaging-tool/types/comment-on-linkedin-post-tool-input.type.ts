import { z } from 'zod';

export const CommentOnLinkedinPostToolInputZodSchema = z.object({
  unipileAccountId: z
    .string()
    .min(1)
    .describe('Unipile LinkedIn account ID to comment from'),
  postId: z
    .string()
    .min(1)
    .describe(
      'LinkedIn post social_id from FETCH_LINKEDIN_ACTIVITY (not the URL post id)',
    ),
  text: z
    .string()
    .min(1)
    .max(1250)
    .describe('Comment text (LinkedIn max 1250 characters)'),
  candidateId: z
    .string()
    .optional()
    .describe('Optional CRM Candidate id for attribution'),
  commentId: z
    .string()
    .optional()
    .default('')
    .describe('Optional existing comment id to reply to'),
});

export type CommentOnLinkedinPostToolInput = z.infer<
  typeof CommentOnLinkedinPostToolInputZodSchema
>;
