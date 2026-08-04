import { type WorkflowActionType } from '@/workflow/types/Workflow';

export const SEND_WHATSAPP_MESSAGE_ACTION: {
  defaultLabel: string;
  type: Extract<WorkflowActionType, 'SEND_WHATSAPP_MESSAGE'>;
  icon: string;
} = {
  defaultLabel: 'Send WhatsApp Message',
  type: 'SEND_WHATSAPP_MESSAGE',
  icon: 'IconBrandWhatsapp',
};
