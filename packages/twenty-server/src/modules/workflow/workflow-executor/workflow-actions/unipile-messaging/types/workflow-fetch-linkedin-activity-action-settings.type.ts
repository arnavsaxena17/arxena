import { type BaseWorkflowActionSettings } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action-settings.type';

import { type WorkflowFetchLinkedinActivityActionInput } from './workflow-fetch-linkedin-activity-action-input.type';

export type WorkflowFetchLinkedinActivityActionSettings =
  BaseWorkflowActionSettings & {
    input: WorkflowFetchLinkedinActivityActionInput;
  };
