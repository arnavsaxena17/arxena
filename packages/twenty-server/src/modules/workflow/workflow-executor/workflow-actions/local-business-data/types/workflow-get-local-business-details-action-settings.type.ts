import {
  type BaseWorkflowActionSettings,
  type WithExpectedOutputSchema,
} from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action-settings.type';
import { type WorkflowGetLocalBusinessDetailsActionInput } from 'src/modules/workflow/workflow-executor/workflow-actions/local-business-data/types/workflow-get-local-business-details-action-input.type';

export type WorkflowGetLocalBusinessDetailsActionSettings =
  BaseWorkflowActionSettings &
    WithExpectedOutputSchema & {
      input: WorkflowGetLocalBusinessDetailsActionInput;
    };
