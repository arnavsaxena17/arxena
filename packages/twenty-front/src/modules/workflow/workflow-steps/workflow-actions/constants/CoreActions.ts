import { type WorkflowActionType } from '@/workflow/types/Workflow';
import { CODE_ACTION } from '@/workflow/workflow-steps/workflow-actions/constants/actions/CodeAction';
import { CREATE_CALENDAR_EVENT_ACTION } from '@/workflow/workflow-steps/workflow-actions/constants/actions/CreateCalendarEventAction';
import { DRAFT_EMAIL_ACTION } from '@/workflow/workflow-steps/workflow-actions/constants/actions/DraftEmailAction';
import { HTTP_REQUEST_ACTION } from '@/workflow/workflow-steps/workflow-actions/constants/actions/HttpRequestAction';
import { SEND_EMAIL_ACTION } from '@/workflow/workflow-steps/workflow-actions/constants/actions/SendEmailAction';
import { SEND_LINKEDIN_CONNECTION_REQUEST_ACTION } from '@/workflow/workflow-steps/workflow-actions/constants/actions/SendLinkedinConnectionRequestAction';
import { SEND_LINKEDIN_INMAIL_ACTION } from '@/workflow/workflow-steps/workflow-actions/constants/actions/SendLinkedinInmailAction';
import { SEND_LINKEDIN_MESSAGE_ACTION } from '@/workflow/workflow-steps/workflow-actions/constants/actions/SendLinkedinMessageAction';
import { SEND_WHATSAPP_MESSAGE_ACTION } from '@/workflow/workflow-steps/workflow-actions/constants/actions/SendWhatsappMessageAction';

export const CORE_ACTIONS: Array<{
  defaultLabel: string;
  type: Extract<
    WorkflowActionType,
    | 'CODE'
    | 'SEND_EMAIL'
    | 'DRAFT_EMAIL'
    | 'HTTP_REQUEST'
    | 'CREATE_CALENDAR_EVENT'
    | 'SEND_LINKEDIN_CONNECTION_REQUEST'
    | 'SEND_LINKEDIN_INMAIL'
    | 'SEND_LINKEDIN_MESSAGE'
    | 'SEND_WHATSAPP_MESSAGE'
  >;
  icon: string;
}> = [
  SEND_EMAIL_ACTION,
  DRAFT_EMAIL_ACTION,
  CREATE_CALENDAR_EVENT_ACTION,
  CODE_ACTION,
  HTTP_REQUEST_ACTION,
  SEND_LINKEDIN_CONNECTION_REQUEST_ACTION,
  SEND_LINKEDIN_INMAIL_ACTION,
  SEND_LINKEDIN_MESSAGE_ACTION,
  SEND_WHATSAPP_MESSAGE_ACTION,
];
