import { type WorkflowActionType } from '@/workflow/types/Workflow';

export const FETCH_LINKEDIN_ACTIVITY_ACTION: {
  defaultLabel: string;
  type: Extract<WorkflowActionType, 'FETCH_LINKEDIN_ACTIVITY'>;
  icon: string;
} = {
  defaultLabel: 'Fetch LinkedIn Posts & Activity',
  type: 'FETCH_LINKEDIN_ACTIVITY',
  icon: 'IconBrandLinkedin',
};
