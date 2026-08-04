import { type WorkflowActionType } from '@/workflow/types/Workflow';

export const SEND_LINKEDIN_MESSAGE_ACTION: {
  defaultLabel: string;
  type: Extract<WorkflowActionType, 'SEND_LINKEDIN_MESSAGE'>;
  icon: string;
} = {
  defaultLabel: 'Send LinkedIn Message',
  type: 'SEND_LINKEDIN_MESSAGE',
  icon: 'IconBrandLinkedin',
};
