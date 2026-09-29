import { z } from 'zod';
import { baseWorkflowActionSettingsSchema } from './base-workflow-action-settings-schema';

export const workflowAcceptLinkedinReceivedInvitationActionSettingsSchema =
  baseWorkflowActionSettingsSchema.extend({
    input: z.object({
      workspaceMemberId: z.string(),
      linkedinProfileId: z.string().optional().default(''),
      linkedinPublicIdentifier: z.string().optional().default(''),
      providerId: z.string().optional().default(''),
      linkedinUrl: z.string().optional().default(''),
      candidateId: z.string().optional(),
      limit: z.number().optional().default(50),
    }),
  });
