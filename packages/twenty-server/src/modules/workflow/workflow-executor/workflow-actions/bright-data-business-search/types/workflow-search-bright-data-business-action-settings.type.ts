import {
  type BaseWorkflowActionSettings,
  type WithExpectedOutputSchema,
} from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action-settings.type';

export type WorkflowSearchBrightDataBusinessActionInput = {
  query: string;
  mode?: 'ludicrous' | 'smart' | 'instant';
  limit?: number;
  offset?: number;
  view?: 'full' | 'summary' | 'id_only';
  projectId?: string;
  maxBudgetUsd?: number;
  targetCount?: number;
};

export type WorkflowSearchBrightDataCompaniesActionSettings =
  BaseWorkflowActionSettings &
    WithExpectedOutputSchema & {
      input: WorkflowSearchBrightDataBusinessActionInput;
    };

export type WorkflowSearchBrightDataPeopleActionSettings =
  WorkflowSearchBrightDataCompaniesActionSettings;
