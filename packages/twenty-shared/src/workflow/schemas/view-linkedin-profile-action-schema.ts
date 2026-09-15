import { z } from 'zod';
import { baseWorkflowActionSchema } from './base-workflow-action-schema';
import { workflowViewLinkedinProfileActionSettingsSchema } from './view-linkedin-profile-action-settings-schema';

export const workflowViewLinkedinProfileActionSchema =
  baseWorkflowActionSchema.extend({
    type: z.literal('VIEW_LINKEDIN_PROFILE'),
    settings: workflowViewLinkedinProfileActionSettingsSchema,
  });
