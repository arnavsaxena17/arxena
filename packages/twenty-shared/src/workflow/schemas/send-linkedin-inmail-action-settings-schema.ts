import { z } from 'zod';
import { baseWorkflowActionSettingsSchema } from './base-workflow-action-settings-schema';

export const workflowSendLinkedinInmailActionSettingsSchema =
  baseWorkflowActionSettingsSchema.extend({
    input: z.object({
      workspaceMemberId: z.string(),
      linkedinProfileId: z.string(),
      subject: z.string().optional().default(''),
      body: z.string().optional().default(''),
    }),
  });
