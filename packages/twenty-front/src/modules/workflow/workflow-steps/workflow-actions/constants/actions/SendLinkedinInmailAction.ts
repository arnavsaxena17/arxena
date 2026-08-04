import { type WorkflowActionType } from '@/workflow/types/Workflow';

export const SEND_LINKEDIN_INMAIL_ACTION: {
  defaultLabel: string;
  type: Extract<WorkflowActionType, 'SEND_LINKEDIN_INMAIL'>;
  icon: string;
} = {
  defaultLabel: 'Send LinkedIn InMail',
  type: 'SEND_LINKEDIN_INMAIL',
  icon: 'IconMail',
};
