import { type WorkflowActionType } from '@/workflow/types/Workflow';

export const SEND_LINKEDIN_VOICE_NOTE_ACTION: {
  defaultLabel: string;
  type: Extract<WorkflowActionType, 'SEND_LINKEDIN_VOICE_NOTE'>;
  icon: string;
} = {
  defaultLabel: 'Send LinkedIn Voice Note',
  type: 'SEND_LINKEDIN_VOICE_NOTE',
  icon: 'IconMicrophone',
};
