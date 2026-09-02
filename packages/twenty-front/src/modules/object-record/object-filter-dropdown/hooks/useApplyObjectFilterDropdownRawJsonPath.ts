import { useUpsertObjectFilterDropdownCurrentFilter } from '@/object-record/object-filter-dropdown/hooks/useUpsertObjectFilterDropdownCurrentFilter';
import { fieldMetadataItemUsedInDropdownComponentSelector } from '@/object-record/object-filter-dropdown/states/fieldMetadataItemUsedInDropdownComponentSelector';
import { objectFilterDropdownCurrentRecordFilterComponentState } from '@/object-record/object-filter-dropdown/states/objectFilterDropdownCurrentRecordFilterComponentState';
import { selectedOperandInDropdownComponentState } from '@/object-record/object-filter-dropdown/states/selectedOperandInDropdownComponentState';
import { subFieldNameUsedInDropdownComponentState } from '@/object-record/object-filter-dropdown/states/subFieldNameUsedInDropdownComponentState';
import { useCreateEmptyRecordFilterFromFieldMetadataItem } from '@/object-record/record-filter/hooks/useCreateEmptyRecordFilterFromFieldMetadataItem';
import { type RecordFilter } from '@/object-record/record-filter/types/RecordFilter';
import { getRecordFilterOperands } from '@/object-record/record-filter/utils/getRecordFilterOperands';
import { useAtomComponentSelectorValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentSelectorValue';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useSetAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useSetAtomComponentState';
import { getFilterTypeFromFieldType, isDefined } from 'twenty-shared/utils';

const WHOLE_FIELD_PATH_VALUE = '';

export const useApplyObjectFilterDropdownRawJsonPath = () => {
  const objectFilterDropdownCurrentRecordFilter = useAtomComponentStateValue(
    objectFilterDropdownCurrentRecordFilterComponentState,
  );

  const fieldMetadataItemUsedInDropdown = useAtomComponentSelectorValue(
    fieldMetadataItemUsedInDropdownComponentSelector,
  );

  const setSubFieldNameUsedInDropdown = useSetAtomComponentState(
    subFieldNameUsedInDropdownComponentState,
  );

  const setSelectedOperandInDropdown = useSetAtomComponentState(
    selectedOperandInDropdownComponentState,
  );

  const { upsertObjectFilterDropdownCurrentFilter } =
    useUpsertObjectFilterDropdownCurrentFilter();

  const { createEmptyRecordFilterFromFieldMetadataItem } =
    useCreateEmptyRecordFilterFromFieldMetadataItem();

  const applyObjectFilterDropdownRawJsonPath = (jsonPath: string | null) => {
    if (!isDefined(fieldMetadataItemUsedInDropdown)) {
      throw new Error(
        'FieldMetadataItemUsedInDropdown is not defined, cannot apply JSON path',
      );
    }

    const filterType = getFilterTypeFromFieldType(
      fieldMetadataItemUsedInDropdown.type,
    );

    const subFieldName =
      isDefined(jsonPath) && jsonPath !== WHOLE_FIELD_PATH_VALUE
        ? jsonPath
        : null;

    const defaultOperand = getRecordFilterOperands({
      filterType,
      subFieldName,
    })[0];

    const baseRecordFilter = isDefined(objectFilterDropdownCurrentRecordFilter)
      ? objectFilterDropdownCurrentRecordFilter
      : createEmptyRecordFilterFromFieldMetadataItem(
          fieldMetadataItemUsedInDropdown,
        ).newRecordFilter;

    const recordFilterToUpsert: RecordFilter = {
      ...baseRecordFilter,
      fieldMetadataId: fieldMetadataItemUsedInDropdown.id,
      type: filterType,
      label: fieldMetadataItemUsedInDropdown.label,
      subFieldName,
      operand: defaultOperand,
      value: '',
      displayValue: '',
    };

    setSubFieldNameUsedInDropdown(subFieldName);
    setSelectedOperandInDropdown(defaultOperand);
    upsertObjectFilterDropdownCurrentFilter(recordFilterToUpsert);
  };

  return {
    applyObjectFilterDropdownRawJsonPath,
  };
};
