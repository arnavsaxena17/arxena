import { type WorkflowActionType } from '@/workflow/types/Workflow';

export const LIKE_LINKEDIN_POST_ACTION: {
  defaultLabel: string;
  type: Extract<WorkflowActionType, 'LIKE_LINKEDIN_POST'>;
  icon: string;
} = {
  defaultLabel: 'Like LinkedIn Post',
  type: 'LIKE_LINKEDIN_POST',
  icon: 'IconThumbUp',
};
