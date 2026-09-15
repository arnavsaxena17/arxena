import { type BaseWorkflowActionSettings } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action-settings.type';

import { type WorkflowViewLinkedinProfileActionInput } from './workflow-view-linkedin-profile-action-input.type';

export type WorkflowViewLinkedinProfileActionSettings =
  BaseWorkflowActionSettings & {
    input: WorkflowViewLinkedinProfileActionInput;
  };
