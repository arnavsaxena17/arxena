import { type WorkflowActionType } from '@/workflow/types/Workflow';

export const SEARCH_LOCAL_BUSINESSES_ACTION: {
  defaultLabel: string;
  type: Extract<WorkflowActionType, 'SEARCH_LOCAL_BUSINESSES'>;
  icon: string;
} = {
  defaultLabel: 'Search Local Businesses',
  type: 'SEARCH_LOCAL_BUSINESSES',
  icon: 'IconMapSearch',
};
