import { type WorkflowActionType } from '@/workflow/types/Workflow';

export const COMMENT_ON_LINKEDIN_POST_ACTION: {
  defaultLabel: string;
  type: Extract<WorkflowActionType, 'COMMENT_ON_LINKEDIN_POST'>;
  icon: string;
} = {
  defaultLabel: 'Comment on LinkedIn Post',
  type: 'COMMENT_ON_LINKEDIN_POST',
  icon: 'IconMessageCircle',
};
