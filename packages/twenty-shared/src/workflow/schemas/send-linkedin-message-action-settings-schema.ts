import { z } from 'zod';
import { baseWorkflowActionSettingsSchema } from './base-workflow-action-settings-schema';

export const workflowSendLinkedinMessageActionSettingsSchema =
  baseWorkflowActionSettingsSchema.extend({
    input: z.object({
      workspaceMemberId: z.string(),
      linkedinProfileId: z.string(),
      body: z.string().optional().default(''),
    }),
  });
