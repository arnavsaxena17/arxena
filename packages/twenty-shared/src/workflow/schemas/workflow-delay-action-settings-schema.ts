import { z } from 'zod';
import { baseWorkflowActionSettingsSchema } from './base-workflow-action-settings-schema';

const workflowDelayDurationSchema = z.object({
  days: z.union([z.number().min(0), z.string()]).optional(),
  hours: z.union([z.number().min(0), z.string()]).optional(),
  minutes: z.union([z.number().min(0), z.string()]).optional(),
  seconds: z.union([z.number().min(0), z.string()]).optional(),
});

export const workflowDelayActionSettingsSchema =
  baseWorkflowActionSettingsSchema.extend({
    input: z.object({
      delayType: z.enum(['SCHEDULED_DATE', 'DURATION', 'RANDOM_DURATION']),
      scheduledDateTime: z.string().nullable().optional(),
      duration: workflowDelayDurationSchema.optional(),
      minDuration: workflowDelayDurationSchema.optional(),
      maxDuration: workflowDelayDurationSchema.optional(),
    }),
  });
