export type BaseSortField = 'candConversationStatus' | 'startChat' | 'startChatCompleted' | 'updatedAt';
export type SortField = BaseSortField | string; // Allow any string for enrichment fields
export type SortDirection = 'asc' | 'desc';

export interface CustomSortState {
  field: SortField;
  direction: SortDirection;
}

