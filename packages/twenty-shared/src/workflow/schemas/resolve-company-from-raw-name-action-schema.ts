import { z } from 'zod';
import { baseWorkflowActionSchema } from './base-workflow-action-schema';
import { workflowResolveCompanyFromRawNameActionSettingsSchema } from './resolve-company-from-raw-name-action-settings-schema';

export const workflowResolveCompanyFromRawNameActionSchema =
  baseWorkflowActionSchema.extend({
    type: z.literal('RESOLVE_COMPANY_FROM_RAW_NAME'),
    settings: workflowResolveCompanyFromRawNameActionSettingsSchema,
  });
