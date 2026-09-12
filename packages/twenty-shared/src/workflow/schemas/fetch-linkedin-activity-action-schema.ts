import { z } from 'zod';
import { baseWorkflowActionSchema } from './base-workflow-action-schema';
import { workflowFetchLinkedinActivityActionSettingsSchema } from './fetch-linkedin-activity-action-settings-schema';

export const workflowFetchLinkedinActivityActionSchema =
  baseWorkflowActionSchema.extend({
    type: z.literal('FETCH_LINKEDIN_ACTIVITY'),
    settings: workflowFetchLinkedinActivityActionSettingsSchema,
  });
