import { CANDIDATE_CONVERSATION_STATUS_LABELS, STATUS_LABELS } from '../TableColumns';

// Define the priority order for status values based on their dictionary order
const STATUS_PRIORITY: Record<string, number> = {};
Object.keys(STATUS_LABELS).forEach((key, index) => {
  STATUS_PRIORITY[key] = index;
});

// Define the priority order for conversation status values based on their dictionary order
const CONVERSATION_STATUS_PRIORITY: Record<string, number> = {};
Object.keys(CANDIDATE_CONVERSATION_STATUS_LABELS).forEach((key, index) => {
  CONVERSATION_STATUS_PRIORITY[key] = index;
});

// Custom sorting function for status columns
export const statusSortFunction = (sortOrder: 'asc' | 'desc') => {
  return (value: any, nextValue: any) => {
    // Handle null/undefined values
    if (value === null || value === undefined) value = '';
    if (nextValue === null || nextValue === undefined) nextValue = '';
    
    // Convert to string for comparison
    const strValue = String(value);
    const strNextValue = String(nextValue);
    
    // Get priority values (higher number = lower priority)
    const priorityA = STATUS_PRIORITY[strValue] ?? Number.MAX_SAFE_INTEGER;
    const priorityB = STATUS_PRIORITY[strNextValue] ?? Number.MAX_SAFE_INTEGER;
    
    // Compare based on priority
    const comparison = priorityA - priorityB;
    
    // Apply sort order
    return sortOrder === 'desc' ? -comparison : comparison;
  };
};

// Custom sorting function for conversation status columns
export const conversationStatusSortFunction = (sortOrder: 'asc' | 'desc') => {
  return (value: any, nextValue: any) => {
    // Handle null/undefined values
    if (value === null || value === undefined) value = '';
    if (nextValue === null || nextValue === undefined) nextValue = '';
    
    // Convert to string for comparison
    const strValue = String(value);
    const strNextValue = String(nextValue);
    
    // Get priority values (higher number = lower priority)
    const priorityA = CONVERSATION_STATUS_PRIORITY[strValue] ?? Number.MAX_SAFE_INTEGER;
    const priorityB = CONVERSATION_STATUS_PRIORITY[strNextValue] ?? Number.MAX_SAFE_INTEGER;
    
    // Compare based on priority
    const comparison = priorityA - priorityB;
    
    // Apply sort order
    return sortOrder === 'desc' ? -comparison : comparison;
  };
};

// Helper function to get the appropriate sort function for a column
export const getCustomSortFunction = (columnData: string, sortOrder: 'asc' | 'desc') => {
  switch (columnData) {
    case 'status':
      return statusSortFunction(sortOrder);
    case 'candConversationStatus':
      return conversationStatusSortFunction(sortOrder);
    default:
      return null; // Use default sorting
  }
};

// Helper function to check if a column needs custom sorting
export const needsCustomSorting = (columnData: string): boolean => {
  return columnData === 'status' || columnData === 'candConversationStatus';
};
