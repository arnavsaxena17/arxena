import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useAtomFamilySelectorValue } from '@/ui/utilities/state/jotai/hooks/useAtomFamilySelectorValue';
import { flowComponentState } from '@/workflow/states/flowComponentState';
import { stepsOutputSchemaFamilySelector } from '@/workflow/states/selectors/stepsOutputSchemaFamilySelector';
import { workflowVisualizerWorkflowVersionIdComponentState } from '@/workflow/states/workflowVisualizerWorkflowVersionIdComponentState';
import { searchVariableThroughOutputSchemaV2 } from '@/workflow/workflow-variables/utils/searchVariableThroughOutputSchemaV2';
import { isDefined } from 'twenty-shared/utils';
import { TRIGGER_STEP_ID, type VariableSearchResult } from 'twenty-shared/workflow';

const EMPTY_VARIABLE_SEARCH_RESULT: VariableSearchResult = {
  variableLabel: undefined,
  variablePathLabel: undefined,
};

export const useSearchVariable = ({
  stepId,
  rawVariableName,
  isFullRecord,
}: {
  stepId: string;
  rawVariableName: string;
  isFullRecord: boolean;
}): VariableSearchResult => {
  const flow = useAtomComponentStateValue(flowComponentState);
  const workflowVisualizerWorkflowVersionId = useAtomComponentStateValue(
    workflowVisualizerWorkflowVersionIdComponentState,
  );
  const workflowVersionId =
    flow?.workflowVersionId ?? workflowVisualizerWorkflowVersionId;

  const [stepOutputSchema] = useAtomFamilySelectorValue(
    stepsOutputSchemaFamilySelector,
    {
      workflowVersionId: workflowVersionId ?? '',
      stepIds: [stepId],
    },
  );

  if (
    !isDefined(flow) ||
    !isDefined(workflowVersionId) ||
    !isDefined(stepOutputSchema)
  ) {
    return EMPTY_VARIABLE_SEARCH_RESULT;
  }

  const stepType =
    stepId === TRIGGER_STEP_ID
      ? flow.trigger?.type
      : flow.steps?.find((step) => step.id === stepId)?.type;

  if (!isDefined(stepType)) {
    return EMPTY_VARIABLE_SEARCH_RESULT;
  }

  return searchVariableThroughOutputSchemaV2({
    stepOutputSchema,
    stepType,
    rawVariableName,
    isFullRecord,
  });
};
