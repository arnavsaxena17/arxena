import { z } from 'zod';
import { baseWorkflowActionSchema } from './base-workflow-action-schema';
import { workflowAcceptLinkedinReceivedInvitationActionSettingsSchema } from './accept-linkedin-received-invitation-action-settings-schema';

export const workflowAcceptLinkedinReceivedInvitationActionSchema =
  baseWorkflowActionSchema.extend({
    type: z.literal('ACCEPT_LINKEDIN_RECEIVED_INVITATION'),
    settings: workflowAcceptLinkedinReceivedInvitationActionSettingsSchema,
  });
