import { z } from 'zod';
import { baseWorkflowActionSchema } from './base-workflow-action-schema';
import { workflowCommentOnLinkedinPostActionSettingsSchema } from './comment-on-linkedin-post-action-settings-schema';

export const workflowCommentOnLinkedinPostActionSchema =
  baseWorkflowActionSchema.extend({
    type: z.literal('COMMENT_ON_LINKEDIN_POST'),
    settings: workflowCommentOnLinkedinPostActionSettingsSchema,
  });
