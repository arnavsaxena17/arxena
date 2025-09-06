import { CustomSortState, SortField } from '../types/sortTypes';

// Define the priority order for conversation status
const CONVERSATION_STATUS_PRIORITY: Record<string, number> = {
  'CANDIDATE_IS_KEEN_TO_CHAT': 1,
  'CANDIDATE_HAS_FOLLOWED_UP_TO_SETUP_CHAT': 2,
  'CONVERSATION_STARTED_HAS_NOT_RESPONDED': 3,
  'SHARED_JD_HAS_NOT_RESPONDED': 4,
  'CANDIDATE_IS_RELUCTANT_TO_DISCUSS_COMPENSATION': 5,
  'CANDIDATE_SALARY_OUT_OF_RANGE': 6,
  'STOPPED_RESPONDING_ON_QUESTIONS': 7,
  'CANDIDATE_REFUSES_TO_RELOCATE': 8,
  'CANDIDATE_DECLINED_OPPORTUNITY': 9,
  'CONVERSATION_CLOSED_TO_BE_CONTACTED': 10,
  'ONLY_ADDED_NO_CONVERSATION': 11,
};

// Define the priority order for boolean fields (true first, then false)
const BOOLEAN_PRIORITY = {
  true: 1,
  false: 2,
};

export const sortCandidates = (candidates: any[], sortState: CustomSortState): any[] => {
  if (!candidates.length) return candidates;

  return [...candidates].sort((a, b) => {
    const { field, direction } = sortState;
    
    let comparison = 0;
    
    switch (field) {
      case 'candConversationStatus':
        comparison = compareConversationStatus(a.candConversationStatus, b.candConversationStatus);
        break;
        
      case 'startChat':
        comparison = compareBoolean(a.startChat, b.startChat);
        break;
        
      case 'startChatCompleted':
        comparison = compareBoolean(a.startChatCompleted, b.startChatCompleted);
        break;
        
      case 'updatedAt':
        comparison = compareDates(a.updatedAt, b.updatedAt);
        break;
        
      default:
        return 0;
    }
    
    // Apply direction (asc/desc)
    return direction === 'desc' ? -comparison : comparison;
  });
};

const compareConversationStatus = (statusA: string | undefined, statusB: string | undefined): number => {
  const priorityA = statusA ? CONVERSATION_STATUS_PRIORITY[statusA] || 999 : 999;
  const priorityB = statusB ? CONVERSATION_STATUS_PRIORITY[statusB] || 999 : 999;
  
  return priorityA - priorityB;
};

const compareBoolean = (valueA: boolean | undefined, valueB: boolean | undefined): number => {
  const priorityA = valueA ? BOOLEAN_PRIORITY.true : BOOLEAN_PRIORITY.false;
  const priorityB = valueB ? BOOLEAN_PRIORITY.true : BOOLEAN_PRIORITY.false;
  
  return priorityA - priorityB;
};

const compareDates = (dateA: string | Date | undefined, dateB: string | Date | undefined): number => {
  if (!dateA && !dateB) return 0;
  if (!dateA) return 1;
  if (!dateB) return -1;
  
  const timeA = new Date(dateA).getTime();
  const timeB = new Date(dateB).getTime();
  
  // Handle invalid dates
  if (isNaN(timeA) && isNaN(timeB)) return 0;
  if (isNaN(timeA)) return 1;
  if (isNaN(timeB)) return -1;
  
  return timeA - timeB;
};

// Helper function to get sort description for display
export const getSortDescription = (sortState: CustomSortState): string => {
  const fieldLabels: Record<SortField, string> = {
    candConversationStatus: 'Conversation Status',
    startChat: 'Chat Started',
    startChatCompleted: 'Chat Completed',
    updatedAt: 'Last Updated',
  };
  
  const directionLabel = sortState.direction === 'asc' ? 'Ascending' : 'Descending';
  return `${fieldLabels[sortState.field]} (${directionLabel})`;
};
