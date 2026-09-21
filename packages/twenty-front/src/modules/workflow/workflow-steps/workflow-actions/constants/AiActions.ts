import { type WorkflowActionType } from '@/workflow/types/Workflow';
import { AI_AGENT_ACTION } from '@/workflow/workflow-steps/workflow-actions/constants/actions/AiAgentAction';
import { AI_FILTERING_ACTION } from '@/workflow/workflow-steps/workflow-actions/constants/actions/AiFilteringAction';

export const AI_ACTIONS: Array<{
  defaultLabel: string;
  type: Extract<WorkflowActionType, 'AI_AGENT' | 'AI_FILTERING'>;
  icon: string;
}> = [AI_AGENT_ACTION, AI_FILTERING_ACTION];
