import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
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
import { getRecordFilterOperands } from '@/object-record/record-filter/utils/getRecordFilterOperands';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useSetRecoilComponentStateV2 } from '@/ui/utilities/state/component-state/hooks/useSetRecoilComponentStateV2';
import { getFilterTypeFromFieldType, isDefined } from 'twenty-shared';

type ApplyAdvancedFilterRelationTargetFieldParams = {
  sourceFieldMetadataItem: FieldMetadataItem;
  relationTargetFieldMetadataItem: FieldMetadataItem;
  recordFilterId: string;
};

// Creates an advanced filter that traverses a relation: the source is the
// relation field, the filter operates on a target field of the related
// object. Filter type comes from the target field; the label combines
// both labels so the chip reads "Source → Target".
export const useApplyAdvancedFilterRelationTargetField = () => {
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

  const applyAdvancedFilterRelationTargetField = ({
    sourceFieldMetadataItem,
    relationTargetFieldMetadataItem,
    recordFilterId,
  }: ApplyAdvancedFilterRelationTargetFieldParams) => {
    setFieldMetadataItemIdUsedInDropdown(sourceFieldMetadataItem.id);

    const filterType = getFilterTypeFromFieldType(
      relationTargetFieldMetadataItem.type,
    );

    const firstOperand = getRecordFilterOperands({
      filterType,
      subFieldName: null,
    })?.[0];

    if (!isDefined(firstOperand)) {
      throw new Error(
        `No valid operand found for relation-traversal filter type: ${filterType}`,
      );
    }

    setSelectedOperandInDropdown(firstOperand);

    const { value, displayValue } = getInitialFilterValue(
      filterType,
      firstOperand,
    );

    const existingRecordFilter = currentRecordFilters.find(
      (recordFilter) => recordFilter.id === recordFilterId,
    );

    const newAdvancedFilter = {
      id: recordFilterId,
      fieldMetadataId: sourceFieldMetadataItem.id,
      displayValue,
      operand: firstOperand,
      value,
      recordFilterGroupId: existingRecordFilter?.recordFilterGroupId,
      positionInRecordFilterGroup:
        existingRecordFilter?.positionInRecordFilterGroup,
      type: filterType,
      label: `${sourceFieldMetadataItem.label} → ${relationTargetFieldMetadataItem.label}`,
      subFieldName: null,
      relationTargetFieldMetadataId: relationTargetFieldMetadataItem.id,
    } satisfies RecordFilter;

    setSubFieldNameUsedInDropdown(null);
    setRelationTargetFieldMetadataIdUsedInDropdown(
      relationTargetFieldMetadataItem.id,
    );

    setObjectFilterDropdownSearchInput('');

    setObjectFilterDropdownCurrentRecordFilter(newAdvancedFilter);
    upsertRecordFilter(newAdvancedFilter);
  };

  return {
    applyAdvancedFilterRelationTargetField,
  };
};
