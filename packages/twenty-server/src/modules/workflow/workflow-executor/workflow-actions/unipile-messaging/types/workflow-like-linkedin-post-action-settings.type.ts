import { type BaseWorkflowActionSettings } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action-settings.type';

import { type WorkflowLikeLinkedinPostActionInput } from './workflow-like-linkedin-post-action-input.type';

export type WorkflowLikeLinkedinPostActionSettings =
  BaseWorkflowActionSettings & {
    input: WorkflowLikeLinkedinPostActionInput;
  };
