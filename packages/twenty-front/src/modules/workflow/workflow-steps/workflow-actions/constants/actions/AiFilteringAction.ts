import { type WorkflowActionType } from '@/workflow/types/Workflow';

export const AI_FILTERING_ACTION: {
  defaultLabel: string;
  type: Extract<WorkflowActionType, 'AI_FILTERING'>;
  icon: string;
} = {
  defaultLabel: 'AI Filtering',
  type: 'AI_FILTERING',
  icon: 'IconFilter',
};
