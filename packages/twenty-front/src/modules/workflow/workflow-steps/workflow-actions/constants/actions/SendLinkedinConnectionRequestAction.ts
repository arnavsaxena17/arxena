import { type WorkflowActionType } from '@/workflow/types/Workflow';

export const SEND_LINKEDIN_CONNECTION_REQUEST_ACTION: {
  defaultLabel: string;
  type: Extract<WorkflowActionType, 'SEND_LINKEDIN_CONNECTION_REQUEST'>;
  icon: string;
} = {
  defaultLabel: 'Send LinkedIn Connection Request',
  type: 'SEND_LINKEDIN_CONNECTION_REQUEST',
  icon: 'IconUserPlus',
};
