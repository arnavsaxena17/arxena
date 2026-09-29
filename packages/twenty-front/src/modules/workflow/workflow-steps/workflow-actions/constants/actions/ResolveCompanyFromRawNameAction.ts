import { type WorkflowActionType } from '@/workflow/types/Workflow';

export const RESOLVE_COMPANY_FROM_RAW_NAME_ACTION: {
  defaultLabel: string;
  type: Extract<WorkflowActionType, 'RESOLVE_COMPANY_FROM_RAW_NAME'>;
  icon: string;
} = {
  defaultLabel: 'Resolve Company From Raw Name',
  type: 'RESOLVE_COMPANY_FROM_RAW_NAME',
  icon: 'IconBuilding',
};
