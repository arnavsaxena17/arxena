import { z } from 'zod';
import { baseWorkflowActionSettingsSchema } from './base-workflow-action-settings-schema';

export const workflowCreateCalendarEventActionSettingsSchema =
  baseWorkflowActionSettingsSchema.extend({
    input: z.object({
      // Incomplete steps may persist null before an account is chosen
      connectedAccountId: z.string().nullable(),
      title: z.string(),
      description: z.string().optional(),
      location: z.string().optional(),
      startsAt: z.string(),
      endsAt: z.string(),
      isFullDay: z.boolean(),
      timeZone: z.string().optional(),
      attendees: z.string().optional().default(''),
      sendInvitations: z.boolean(),
      addConferencing: z.boolean(),
    }),
  });
