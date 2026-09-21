import { type WorkflowActionType } from '@/workflow/types/Workflow';
import { assertUnreachable } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';

export const getActionIconColorOrThrow = (
  actionType: WorkflowActionType,
): string => {
  switch (actionType) {
    case 'CODE':
    case 'LOGIC_FUNCTION':
    case 'HTTP_REQUEST':
    case 'SEND_EMAIL':
    case 'DRAFT_EMAIL':
    case 'CREATE_CALENDAR_EVENT':
    case 'SEND_LINKEDIN_CONNECTION_REQUEST':
    case 'SEND_LINKEDIN_INMAIL':
    case 'SEND_LINKEDIN_MESSAGE':
    case 'FETCH_LINKEDIN_ACTIVITY':
    case 'COMMENT_ON_LINKEDIN_POST':
    case 'SEND_LINKEDIN_VOICE_NOTE':
    case 'VIEW_LINKEDIN_PROFILE':
    case 'FOLLOW_LINKEDIN_PROFILE':
    case 'LIKE_LINKEDIN_POST':
    case 'SEND_WHATSAPP_MESSAGE':
    case 'SEARCH_LOCAL_BUSINESSES':
    case 'GET_LOCAL_BUSINESS_DETAILS':
      return themeCssVariables.color.red;
    case 'CREATE_RECORD':
    case 'UPDATE_RECORD':
    case 'DELETE_RECORD':
    case 'UPSERT_RECORD':
    case 'FIND_RECORDS':
    case 'PICK_RECORD':
      return themeCssVariables.font.color.tertiary;
    case 'FORM':
      return themeCssVariables.color.orange;
    case 'ITERATOR':
    case 'EMPTY':
    case 'FILTER':
    case 'IF_ELSE':
    case 'DELAY':
      return themeCssVariables.color.green12;
    case 'AI_AGENT':
    case 'AI_FILTERING':
      return themeCssVariables.color.pink;
    default:
      assertUnreachable(actionType, `Unsupported action type: ${actionType}`);
  }
};
