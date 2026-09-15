import { z } from 'zod';
import { baseWorkflowActionSchema } from './base-workflow-action-schema';
import { workflowLikeLinkedinPostActionSettingsSchema } from './like-linkedin-post-action-settings-schema';

export const workflowLikeLinkedinPostActionSchema =
  baseWorkflowActionSchema.extend({
    type: z.literal('LIKE_LINKEDIN_POST'),
    settings: workflowLikeLinkedinPostActionSettingsSchema,
  });
