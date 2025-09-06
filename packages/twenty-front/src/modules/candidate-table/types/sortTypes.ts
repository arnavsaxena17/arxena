export type SortField = 'candConversationStatus' | 'startChat' | 'startChatCompleted' | 'updatedAt';
export type SortDirection = 'asc' | 'desc';

export interface CustomSortState {
  field: SortField;
  direction: SortDirection;
}

