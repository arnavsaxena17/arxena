import { type WorkflowActionType } from '@/workflow/types/Workflow';

export const SEARCH_BRIGHT_DATA_PEOPLE_ACTION: {
  defaultLabel: string;
  type: Extract<WorkflowActionType, 'SEARCH_BRIGHT_DATA_PEOPLE'>;
  icon: string;
} = {
  defaultLabel: 'Search Bright Data People',
  type: 'SEARCH_BRIGHT_DATA_PEOPLE',
  icon: 'IconUsers',
};
