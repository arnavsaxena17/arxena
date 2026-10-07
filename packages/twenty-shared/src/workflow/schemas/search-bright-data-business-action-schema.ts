import { z } from 'zod';

import { baseWorkflowActionSchema } from './base-workflow-action-schema';
import {
  workflowSearchBrightDataCompaniesActionSettingsSchema,
  workflowSearchBrightDataPeopleActionSettingsSchema,
} from './search-bright-data-business-action-settings-schema';

export const workflowSearchBrightDataCompaniesActionSchema =
  baseWorkflowActionSchema.extend({
    type: z.literal('SEARCH_BRIGHT_DATA_COMPANIES'),
    settings: workflowSearchBrightDataCompaniesActionSettingsSchema,
  });

export const workflowSearchBrightDataPeopleActionSchema =
  baseWorkflowActionSchema.extend({
    type: z.literal('SEARCH_BRIGHT_DATA_PEOPLE'),
    settings: workflowSearchBrightDataPeopleActionSettingsSchema,
  });
