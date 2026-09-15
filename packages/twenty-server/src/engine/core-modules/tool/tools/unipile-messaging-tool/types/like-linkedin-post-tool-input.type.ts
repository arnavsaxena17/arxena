import { z } from 'zod';

export const LikeLinkedinPostToolInputZodSchema = z.object({
  unipileAccountId: z
    .string()
    .min(1)
    .describe('Unipile LinkedIn account ID to react from'),
  postId: z
    .string()
    .min(1)
    .describe(
      'LinkedIn post social_id from FETCH_LINKEDIN_ACTIVITY (not the URL post id)',
    ),
  reactionType: z
    .enum(['like', 'celebrate', 'support', 'love', 'insightful', 'funny'])
    .optional()
    .default('like')
    .describe('LinkedIn reaction type (default like)'),
  candidateId: z
    .string()
    .optional()
    .describe('Optional CRM Candidate id for attribution'),
  commentId: z
    .string()
    .optional()
    .default('')
    .describe('Optional existing comment id to react to'),
});

export type LikeLinkedinPostToolInput = z.infer<
  typeof LikeLinkedinPostToolInputZodSchema
>;
