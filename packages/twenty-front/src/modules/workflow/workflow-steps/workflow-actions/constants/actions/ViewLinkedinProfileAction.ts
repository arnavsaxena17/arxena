import { type WorkflowActionType } from '@/workflow/types/Workflow';

export const VIEW_LINKEDIN_PROFILE_ACTION: {
  defaultLabel: string;
  type: Extract<WorkflowActionType, 'VIEW_LINKEDIN_PROFILE'>;
  icon: string;
} = {
  defaultLabel: 'View LinkedIn Profile',
  type: 'VIEW_LINKEDIN_PROFILE',
  icon: 'IconEye',
};
