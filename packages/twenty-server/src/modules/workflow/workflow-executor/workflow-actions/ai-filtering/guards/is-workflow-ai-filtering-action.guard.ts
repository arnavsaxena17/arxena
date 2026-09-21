import {
  type WorkflowAction,
  type WorkflowAiFilteringAction,
} from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action.type';
import { WorkflowActionType } from 'twenty-shared/workflow';

export const isWorkflowAiFilteringAction = (
  action: WorkflowAction,
): action is WorkflowAiFilteringAction => {
  return action.type === WorkflowActionType.AI_FILTERING;
};
