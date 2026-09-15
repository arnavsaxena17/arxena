import { type BaseWorkflowActionSettings } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action-settings.type';

import { type WorkflowFollowLinkedinProfileActionInput } from './workflow-follow-linkedin-profile-action-input.type';

export type WorkflowFollowLinkedinProfileActionSettings =
  BaseWorkflowActionSettings & {
    input: WorkflowFollowLinkedinProfileActionInput;
  };
