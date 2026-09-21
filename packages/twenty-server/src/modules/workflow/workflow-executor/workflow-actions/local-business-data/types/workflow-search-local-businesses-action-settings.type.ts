import {
  type BaseWorkflowActionSettings,
  type WithExpectedOutputSchema,
} from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action-settings.type';
import { type WorkflowSearchLocalBusinessesActionInput } from 'src/modules/workflow/workflow-executor/workflow-actions/local-business-data/types/workflow-search-local-businesses-action-input.type';

export type WorkflowSearchLocalBusinessesActionSettings =
  BaseWorkflowActionSettings &
    WithExpectedOutputSchema & {
      input: WorkflowSearchLocalBusinessesActionInput;
    };
