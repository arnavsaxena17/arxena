import { z } from 'zod';
import { baseWorkflowActionSettingsSchema } from './base-workflow-action-settings-schema';

export const workflowCommentOnLinkedinPostActionSettingsSchema =
  baseWorkflowActionSettingsSchema.extend({
    input: z.object({
      workspaceMemberId: z.string(),
      postId: z.string(),
      text: z.string(),
      linkedinProfileId: z.string().optional().default(''),
      linkedinUrl: z.string().optional().default(''),
      candidateId: z.string().optional(),
      commentId: z.string().optional().default(''),
    }),
  });
