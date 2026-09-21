import { z } from 'zod';
import { baseWorkflowActionSchema } from './base-workflow-action-schema';
import { workflowGetLocalBusinessDetailsActionSettingsSchema } from './get-local-business-details-action-settings-schema';

export const workflowGetLocalBusinessDetailsActionSchema =
  baseWorkflowActionSchema.extend({
    type: z.literal('GET_LOCAL_BUSINESS_DETAILS'),
    settings: workflowGetLocalBusinessDetailsActionSettingsSchema,
  });
