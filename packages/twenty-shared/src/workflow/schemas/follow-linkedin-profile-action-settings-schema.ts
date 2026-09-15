import { z } from 'zod';
import { baseWorkflowActionSettingsSchema } from './base-workflow-action-settings-schema';

export const workflowFollowLinkedinProfileActionSettingsSchema =
  baseWorkflowActionSettingsSchema.extend({
    input: z.object({
      workspaceMemberId: z.string(),
      linkedinProfileId: z.string(),
      linkedinUrl: z.string().optional().default(''),
      candidateId: z.string().optional(),
    }),
  });
