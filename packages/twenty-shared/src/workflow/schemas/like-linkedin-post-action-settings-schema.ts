import { z } from 'zod';
import { baseWorkflowActionSettingsSchema } from './base-workflow-action-settings-schema';

export const linkedinPostReactionTypeSchema = z.enum([
  'like',
  'celebrate',
  'support',
  'love',
  'insightful',
  'funny',
]);

export const workflowLikeLinkedinPostActionSettingsSchema =
  baseWorkflowActionSettingsSchema.extend({
    input: z.object({
      workspaceMemberId: z.string(),
      postId: z.string(),
      reactionType: linkedinPostReactionTypeSchema.optional().default('like'),
      candidateId: z.string().optional(),
      commentId: z.string().optional().default(''),
    }),
  });
