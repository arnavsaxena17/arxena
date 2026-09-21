import { type WorkflowAiFilteringActionInput } from 'src/modules/workflow/workflow-executor/workflow-actions/ai-filtering/types/workflow-ai-filtering-action-input.type';
import { type BaseWorkflowActionSettings } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action-settings.type';

export type WorkflowAiFilteringActionSettings = BaseWorkflowActionSettings & {
  input: WorkflowAiFilteringActionInput;
};
