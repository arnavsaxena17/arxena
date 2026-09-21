import { type WorkflowActionType } from '@/workflow/types/Workflow';

export const GET_LOCAL_BUSINESS_DETAILS_ACTION: {
  defaultLabel: string;
  type: Extract<WorkflowActionType, 'GET_LOCAL_BUSINESS_DETAILS'>;
  icon: string;
} = {
  defaultLabel: 'Get Local Business Details',
  type: 'GET_LOCAL_BUSINESS_DETAILS',
  icon: 'IconBuildingStore',
};
