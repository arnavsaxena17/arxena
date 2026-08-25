import { z } from 'zod';
import { baseWorkflowActionSettingsSchema } from './base-workflow-action-settings-schema';

export const workflowSendLinkedinConnectionRequestActionSettingsSchema =
  baseWorkflowActionSettingsSchema.extend({
    input: z.object({
      workspaceMemberId: z.string(),
      linkedinProfileId: z.string(),
      linkedinUrl: z.string().optional().default(''),
      message: z.string().optional().default(''),
    }),
  });
