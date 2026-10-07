import { type WorkflowActionType } from '@/workflow/types/Workflow';

export const SEARCH_BRIGHT_DATA_COMPANIES_ACTION: {
  defaultLabel: string;
  type: Extract<WorkflowActionType, 'SEARCH_BRIGHT_DATA_COMPANIES'>;
  icon: string;
} = {
  defaultLabel: 'Search Bright Data Companies',
  type: 'SEARCH_BRIGHT_DATA_COMPANIES',
  icon: 'IconBuilding',
};
