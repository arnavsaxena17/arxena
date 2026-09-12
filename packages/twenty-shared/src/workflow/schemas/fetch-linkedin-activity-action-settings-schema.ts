import { z } from 'zod';
import { baseWorkflowActionSettingsSchema } from './base-workflow-action-settings-schema';

export const workflowFetchLinkedinActivityActionSettingsSchema =
  baseWorkflowActionSettingsSchema.extend({
    input: z.object({
      workspaceMemberId: z.string(),
      linkedinProfileId: z.string(),
      linkedinUrl: z.string().optional().default(''),
      candidateId: z.string().optional(),
      postsLimit: z.number().optional().default(10),
      includeUserComments: z.boolean().optional().default(true),
      userCommentsLimit: z.number().optional().default(10),
    }),
  });
