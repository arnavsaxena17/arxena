import { type StepFilter, type StepFilterGroup } from 'twenty-shared';

import { type BaseWorkflowActionSettings } from 'src/modules/workflow/workflow-executor/workflow-actions/types/workflow-action-settings.type';

export type WorkflowFilterActionSettings = BaseWorkflowActionSettings & {
  input: {
    stepFilterGroups?: StepFilterGroup[];
    stepFilters?: StepFilter[];
  };
};
