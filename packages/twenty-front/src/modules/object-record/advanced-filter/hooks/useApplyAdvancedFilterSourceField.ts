import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { getDefaultAdvancedFilterOperand } from '@/object-record/advanced-filter/utils/getDefaultAdvancedFilterOperand';
import { useGetInitialFilterValue } from '@/object-record/object-filter-dropdown/hooks/useGetInitialFilterValue';
import { fieldMetadataItemIdUsedInDropdownComponentState } from '@/object-record/object-filter-dropdown/states/fieldMetadataItemIdUsedInDropdownComponentState';
import { objectFilterDropdownCurrentRecordFilterComponentState } from '@/object-record/object-filter-dropdown/states/objectFilterDropdownCurrentRecordFilterComponentState';
import { objectFilterDropdownSearchInputComponentState } from '@/object-record/object-filter-dropdown/states/objectFilterDropdownSearchInputComponentState';
import { relationTargetFieldMetadataIdUsedInDropdownComponentState } from '@/object-record/object-filter-dropdown/states/relationTargetFieldMetadataIdUsedInDropdownComponentState';
import { selectedOperandInDropdownComponentState } from '@/object-record/object-filter-dropdown/states/selectedOperandInDropdownComponentState';
import { subFieldNameUsedInDropdownComponentState } from '@/object-record/object-filter-dropdown/states/subFieldNameUsedInDropdownComponentState';
import { useUpsertRecordFilter } from '@/object-record/record-filter/hooks/useUpsertRecordFilter';
import { currentRecordFiltersComponentState } from '@/object-record/record-filter/states/currentRecordFiltersComponentState';
import { type RecordFilter } from '@/object-record/record-filter/types/RecordFilter';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useSetRecoilComponentStateV2 } from '@/ui/utilities/state/component-state/hooks/useSetRecoilComponentStateV2';
import { getFilterTypeFromFieldType, isDefined } from 'twenty-shared';

type ApplyAdvancedFilterSourceFieldParams = {
  sourceFieldMetadataItem: FieldMetadataItem;
  recordFilterId: string;
};

// Creates a leaf advanced filter from a source field selection. Composite
// and many-to-one relation sources are handled by their own specialized
// hooks (useApplyAdvancedFilterCompositeSubField,
// useApplyAdvancedFilterRelationTargetField) — callers branch to those
// before reaching this hook.
export const useApplyAdvancedFilterSourceField = () => {
  const setSelectedOperandInDropdown = useSetRecoilComponentStateV2(
    selectedOperandInDropdownComponentState,
  );

  const setFieldMetadataItemIdUsedInDropdown = useSetRecoilComponentStateV2(
    fieldMetadataItemIdUsedInDropdownComponentState,
  );

  const setObjectFilterDropdownSearchInput = useSetRecoilComponentStateV2(
    objectFilterDropdownSearchInputComponentState,
  );

  const setSubFieldNameUsedInDropdown = useSetRecoilComponentStateV2(
    subFieldNameUsedInDropdownComponentState,
  );

  const setRelationTargetFieldMetadataIdUsedInDropdown =
    useSetRecoilComponentStateV2(
      relationTargetFieldMetadataIdUsedInDropdownComponentState,
    );

  const setObjectFilterDropdownCurrentRecordFilter = useSetRecoilComponentStateV2(
    objectFilterDropdownCurrentRecordFilterComponentState,
  );

  const currentRecordFilters = useRecoilComponentValueV2(
    currentRecordFiltersComponentState,
  );

  const { upsertRecordFilter } = useUpsertRecordFilter();
  const { getInitialFilterValue } = useGetInitialFilterValue();

  const applyAdvancedFilterSourceField = ({
    sourceFieldMetadataItem,
    recordFilterId,
  }: ApplyAdvancedFilterSourceFieldParams) => {
    setFieldMetadataItemIdUsedInDropdown(sourceFieldMetadataItem.id);

    const filterType = getFilterTypeFromFieldType(sourceFieldMetadataItem.type);

    const defaultOperand = getDefaultAdvancedFilterOperand({
      filterType,
      subFieldName: null,
    });

    if (!isDefined(defaultOperand)) {
      throw new Error(`No valid operand found for filter type: ${filterType}`);
    }

    setSelectedOperandInDropdown(defaultOperand);

    const { value, displayValue } = getInitialFilterValue(
      filterType,
      defaultOperand,
    );

    const existingRecordFilter = currentRecordFilters.find(
      (recordFilter) => recordFilter.id === recordFilterId,
    );

    const newAdvancedFilter = {
      id: recordFilterId,
      fieldMetadataId: sourceFieldMetadataItem.id,
      displayValue,
      operand: defaultOperand,
      value,
      recordFilterGroupId: existingRecordFilter?.recordFilterGroupId,
      positionInRecordFilterGroup:
        existingRecordFilter?.positionInRecordFilterGroup,
      type: filterType,
      label: sourceFieldMetadataItem.label,
      subFieldName: null,
      relationTargetFieldMetadataId: null,
    } satisfies RecordFilter;

    setSubFieldNameUsedInDropdown(null);
    setRelationTargetFieldMetadataIdUsedInDropdown(null);

    setObjectFilterDropdownSearchInput('');

    setObjectFilterDropdownCurrentRecordFilter(newAdvancedFilter);
    upsertRecordFilter(newAdvancedFilter);
  };

  return {
    applyAdvancedFilterSourceField,
  };
};
