import {
  type BaseWorkflowActionSettings,
  type WithExpectedOutputSchema,
} from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action-settings.type';
import { type WorkflowResolveCompanyFromRawNameActionInput } from 'src/modules/workflow/workflow-executor/workflow-actions/company-name-resolver/types/workflow-resolve-company-from-raw-name-action-input.type';

export type WorkflowResolveCompanyFromRawNameActionSettings =
  BaseWorkflowActionSettings &
    WithExpectedOutputSchema & {
      input: WorkflowResolveCompanyFromRawNameActionInput;
    };
