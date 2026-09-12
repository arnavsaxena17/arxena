import { type BaseWorkflowActionSettings } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action-settings.type';

import { type WorkflowCommentOnLinkedinPostActionInput } from './workflow-comment-on-linkedin-post-action-input.type';

export type WorkflowCommentOnLinkedinPostActionSettings =
  BaseWorkflowActionSettings & {
    input: WorkflowCommentOnLinkedinPostActionInput;
  };
