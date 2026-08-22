import { createAtomFamilyState } from '@/ui/utilities/state/jotai/utils/createAtomFamilyState';
import { type WorkflowFormNotifyTestData } from '@/workflow/workflow-steps/workflow-actions/form-action/types/WorkflowFormNotifyTestData';

export const workflowFormNotifyTestDataFamilyState = createAtomFamilyState<
  WorkflowFormNotifyTestData,
  string
>({
  key: 'workflowFormNotifyTestDataFamilyState',
  defaultValue: {
    language: 'json',
    variableValues: {},
    output: {},
  },
});
