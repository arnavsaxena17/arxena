import { type WorkflowActionType } from '@/workflow/types/Workflow';

export const ACCEPT_LINKEDIN_RECEIVED_INVITATION_ACTION: {
  defaultLabel: string;
  type: Extract<WorkflowActionType, 'ACCEPT_LINKEDIN_RECEIVED_INVITATION'>;
  icon: string;
} = {
  defaultLabel: 'Accept received invitation',
  type: 'ACCEPT_LINKEDIN_RECEIVED_INVITATION',
  icon: 'IconUserPlus',
};
