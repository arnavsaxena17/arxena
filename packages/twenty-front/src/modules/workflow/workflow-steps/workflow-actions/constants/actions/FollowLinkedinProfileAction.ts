import { type WorkflowActionType } from '@/workflow/types/Workflow';

export const FOLLOW_LINKEDIN_PROFILE_ACTION: {
  defaultLabel: string;
  type: Extract<WorkflowActionType, 'FOLLOW_LINKEDIN_PROFILE'>;
  icon: string;
} = {
  defaultLabel: 'Follow LinkedIn Profile',
  type: 'FOLLOW_LINKEDIN_PROFILE',
  icon: 'IconUserPlus',
};
