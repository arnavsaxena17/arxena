import { type WorkflowActionType } from '@/workflow/types/Workflow';
import { CODE_ACTION } from '@/workflow/workflow-steps/workflow-actions/constants/actions/CodeAction';
import { CREATE_CALENDAR_EVENT_ACTION } from '@/workflow/workflow-steps/workflow-actions/constants/actions/CreateCalendarEventAction';
import { DRAFT_EMAIL_ACTION } from '@/workflow/workflow-steps/workflow-actions/constants/actions/DraftEmailAction';
import { HTTP_REQUEST_ACTION } from '@/workflow/workflow-steps/workflow-actions/constants/actions/HttpRequestAction';
import { SEND_EMAIL_ACTION } from '@/workflow/workflow-steps/workflow-actions/constants/actions/SendEmailAction';
import { SEND_LINKEDIN_CONNECTION_REQUEST_ACTION } from '@/workflow/workflow-steps/workflow-actions/constants/actions/SendLinkedinConnectionRequestAction';
import { SEND_LINKEDIN_INMAIL_ACTION } from '@/workflow/workflow-steps/workflow-actions/constants/actions/SendLinkedinInmailAction';
import { SEND_LINKEDIN_MESSAGE_ACTION } from '@/workflow/workflow-steps/workflow-actions/constants/actions/SendLinkedinMessageAction';
import { FETCH_LINKEDIN_ACTIVITY_ACTION } from '@/workflow/workflow-steps/workflow-actions/constants/actions/FetchLinkedinActivityAction';
import { COMMENT_ON_LINKEDIN_POST_ACTION } from '@/workflow/workflow-steps/workflow-actions/constants/actions/CommentOnLinkedinPostAction';
import { SEND_LINKEDIN_VOICE_NOTE_ACTION } from '@/workflow/workflow-steps/workflow-actions/constants/actions/SendLinkedinVoiceNoteAction';
import { VIEW_LINKEDIN_PROFILE_ACTION } from '@/workflow/workflow-steps/workflow-actions/constants/actions/ViewLinkedinProfileAction';
import { FOLLOW_LINKEDIN_PROFILE_ACTION } from '@/workflow/workflow-steps/workflow-actions/constants/actions/FollowLinkedinProfileAction';
import { LIKE_LINKEDIN_POST_ACTION } from '@/workflow/workflow-steps/workflow-actions/constants/actions/LikeLinkedinPostAction';
import { ACCEPT_LINKEDIN_RECEIVED_INVITATION_ACTION } from '@/workflow/workflow-steps/workflow-actions/constants/actions/AcceptLinkedinReceivedInvitationAction';
import { SEND_WHATSAPP_MESSAGE_ACTION } from '@/workflow/workflow-steps/workflow-actions/constants/actions/SendWhatsappMessageAction';
import { SEARCH_LOCAL_BUSINESSES_ACTION } from '@/workflow/workflow-steps/workflow-actions/constants/actions/SearchLocalBusinessesAction';
import { SEARCH_BRIGHT_DATA_COMPANIES_ACTION } from '@/workflow/workflow-steps/workflow-actions/constants/actions/SearchBrightDataCompaniesAction';
import { SEARCH_BRIGHT_DATA_PEOPLE_ACTION } from '@/workflow/workflow-steps/workflow-actions/constants/actions/SearchBrightDataPeopleAction';
import { GET_LOCAL_BUSINESS_DETAILS_ACTION } from '@/workflow/workflow-steps/workflow-actions/constants/actions/GetLocalBusinessDetailsAction';
import { RESOLVE_COMPANY_FROM_RAW_NAME_ACTION } from '@/workflow/workflow-steps/workflow-actions/constants/actions/ResolveCompanyFromRawNameAction';

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
    | 'FETCH_LINKEDIN_ACTIVITY'
    | 'COMMENT_ON_LINKEDIN_POST'
    | 'SEND_LINKEDIN_VOICE_NOTE'
    | 'VIEW_LINKEDIN_PROFILE'
    | 'FOLLOW_LINKEDIN_PROFILE'
    | 'LIKE_LINKEDIN_POST'
    | 'ACCEPT_LINKEDIN_RECEIVED_INVITATION'
    | 'SEND_WHATSAPP_MESSAGE'
    | 'SEARCH_LOCAL_BUSINESSES'
    | 'SEARCH_BRIGHT_DATA_COMPANIES'
    | 'SEARCH_BRIGHT_DATA_PEOPLE'
    | 'GET_LOCAL_BUSINESS_DETAILS'
    | 'RESOLVE_COMPANY_FROM_RAW_NAME'
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
  FETCH_LINKEDIN_ACTIVITY_ACTION,
  COMMENT_ON_LINKEDIN_POST_ACTION,
  SEND_LINKEDIN_VOICE_NOTE_ACTION,
  VIEW_LINKEDIN_PROFILE_ACTION,
  FOLLOW_LINKEDIN_PROFILE_ACTION,
  LIKE_LINKEDIN_POST_ACTION,
  ACCEPT_LINKEDIN_RECEIVED_INVITATION_ACTION,
  SEND_WHATSAPP_MESSAGE_ACTION,
  SEARCH_LOCAL_BUSINESSES_ACTION,
  SEARCH_BRIGHT_DATA_COMPANIES_ACTION,
  SEARCH_BRIGHT_DATA_PEOPLE_ACTION,
  GET_LOCAL_BUSINESS_DETAILS_ACTION,
  RESOLVE_COMPANY_FROM_RAW_NAME_ACTION,
];
