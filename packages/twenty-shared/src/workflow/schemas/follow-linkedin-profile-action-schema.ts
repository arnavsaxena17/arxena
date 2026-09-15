import { z } from 'zod';
import { baseWorkflowActionSchema } from './base-workflow-action-schema';
import { workflowFollowLinkedinProfileActionSettingsSchema } from './follow-linkedin-profile-action-settings-schema';

export const workflowFollowLinkedinProfileActionSchema =
  baseWorkflowActionSchema.extend({
    type: z.literal('FOLLOW_LINKEDIN_PROFILE'),
    settings: workflowFollowLinkedinProfileActionSettingsSchema,
  });
