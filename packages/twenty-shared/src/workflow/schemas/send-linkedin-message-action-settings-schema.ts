import { z } from 'zod';
import { baseWorkflowActionSettingsSchema } from './base-workflow-action-settings-schema';
import { workflowEmailFilesSchema } from './send-email-action-settings-schema';

export const workflowSendLinkedinMessageActionSettingsSchema =
  baseWorkflowActionSettingsSchema.extend({
    input: z.object({
      workspaceMemberId: z.string(),
      linkedinProfileId: z.string(),
      linkedinUrl: z.string().optional().default(''),
      candidateId: z.string().optional(),
      body: z.string().optional().default(''),
      files: workflowEmailFilesSchema,
    }),
  });
