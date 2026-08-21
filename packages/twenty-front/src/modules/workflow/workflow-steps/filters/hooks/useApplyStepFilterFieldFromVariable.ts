import { useGetFieldMetadataItemByIdOrThrow } from '@/object-metadata/hooks/useGetFieldMetadataItemById';
import { useGetInitialFilterValue } from '@/object-record/object-filter-dropdown/hooks/useGetInitialFilterValue';
import { useWorkflowVersionIdOrThrow } from '@/workflow/hooks/useWorkflowVersionIdOrThrow';
import { stepsOutputSchemaFamilySelector } from '@/workflow/states/selectors/stepsOutputSchemaFamilySelector';
import { useUpsertStepFilterSettings } from '@/workflow/workflow-steps/filters/hooks/useUpsertStepFilterSettings';
import { getStepFilterOperands } from '@/workflow/workflow-steps/filters/utils/getStepFilterOperands';
import { searchVariableThroughOutputSchemaV2 } from '@/workflow/workflow-variables/utils/searchVariableThroughOutputSchemaV2';
import { useStore } from 'jotai';
import { useCallback } from 'react';
import type { FilterableAndTSVectorFieldType, StepFilter } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { extractRawVariableNamePart } from 'twenty-shared/workflow';

export const useApplyStepFilterFieldFromVariable = () => {
  const { upsertStepFilterSettings } = useUpsertStepFilterSettings();
  const { getFieldMetadataItemByIdOrThrow } =
    useGetFieldMetadataItemByIdOrThrow();
  const workflowVersionId = useWorkflowVersionIdOrThrow();
  const { getInitialFilterValue } = useGetInitialFilterValue();
  const jotaiStore = useStore();

  const applyStepFilterFieldFromVariable = useCallback(
    ({
      stepFilter,
      rawVariableName,
      isFullRecord,
      stepType,
    }: {
      stepFilter: StepFilter;
      rawVariableName: string;
      isFullRecord: boolean;
      stepType: string;
    }) => {
      const stepId = extractRawVariableNamePart({
        rawVariableName,
        part: 'stepId',
      });
      const [currentStepOutputSchema] = jotaiStore.get(
        stepsOutputSchemaFamilySelector.selectorFamily({
          workflowVersionId,
          stepIds: [stepId],
        }),
      );

      if (!isDefined(currentStepOutputSchema)) {
        return;
      }

      const { variableType, fieldMetadataId, compositeFieldSubFieldName } =
        searchVariableThroughOutputSchemaV2({
          stepOutputSchema: currentStepOutputSchema,
          stepType: stepType as never,
          rawVariableName,
          isFullRecord: false,
        });

      const { fieldMetadataItem: filterFieldMetadataItem } = isDefined(
        fieldMetadataId,
      )
        ? getFieldMetadataItemByIdOrThrow(fieldMetadataId)
        : { fieldMetadataItem: undefined };

      const filterType = isDefined(fieldMetadataId)
        ? (filterFieldMetadataItem?.type ?? 'unknown')
        : variableType;

      const availableOperandsForFilter = getStepFilterOperands({
        filterType,
        subFieldName: compositeFieldSubFieldName,
      });
      const defaultOperand = availableOperandsForFilter[0];

      const { value } = getInitialFilterValue(
        filterType as FilterableAndTSVectorFieldType,
        defaultOperand,
      );

      upsertStepFilterSettings({
        stepFilterToUpsert: {
          ...stepFilter,
          stepOutputKey: rawVariableName,
          isFullRecord,
          type: filterType ?? 'unknown',
          value,
          fieldMetadataId,
          compositeFieldSubFieldName,
          operand: defaultOperand,
        },
      });
    },
    [
      jotaiStore,
      workflowVersionId,
      getFieldMetadataItemByIdOrThrow,
      upsertStepFilterSettings,
      getInitialFilterValue,
    ],
  );

  return { applyStepFilterFieldFromVariable };
};
