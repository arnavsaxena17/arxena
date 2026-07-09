import { ADVANCED_FILTER_LOGICAL_OPERATOR_OPTIONS } from '@/object-record/advanced-filter/constants/AdvancedFilterLogicalOperatorOptions';
import { DEFAULT_ADVANCED_FILTER_DROPDOWN_OFFSET } from '@/object-record/advanced-filter/constants/DefaultAdvancedFilterDropdownOffset';
import { useUpsertRecordFilterGroup } from '@/object-record/record-filter-group/hooks/useUpsertRecordFilterGroup';
import { RecordFilterGroup } from '@/object-record/record-filter-group/types/RecordFilterGroup';
import { Select } from '@/ui/input/components/Select';
import { GenericDropdownContentWidth } from '@/ui/layout/dropdown/constants/GenericDropdownContentWidth';
import { ViewFilterGroupLogicalOperator } from '@/views/types/ViewFilterGroupLogicalOperator';

type AdvancedFilterRecordFilterGroupLogicalOperatorDropdownProps = {
  recordFilterGroup: RecordFilterGroup;
};

export const AdvancedFilterRecordFilterGroupLogicalOperatorDropdown = ({
  recordFilterGroup,
}: AdvancedFilterRecordFilterGroupLogicalOperatorDropdownProps) => {
  const { upsertRecordFilterGroup } = useUpsertRecordFilterGroup();

  const handleChange = (value: ViewFilterGroupLogicalOperator) => {
    upsertRecordFilterGroup({
      id: recordFilterGroup.id,
      parentRecordFilterGroupId: recordFilterGroup.parentRecordFilterGroupId,
      positionInRecordFilterGroup:
        recordFilterGroup.positionInRecordFilterGroup,
      logicalOperator: value,
    });
  };

  return (
    <Select
      dropdownWidth={GenericDropdownContentWidth.Narrow}
      dropdownId={`advanced-filter-logical-operator-${recordFilterGroup.id}`}
      value={recordFilterGroup.logicalOperator}
      onChange={handleChange}
      options={ADVANCED_FILTER_LOGICAL_OPERATOR_OPTIONS}
      dropdownOffset={DEFAULT_ADVANCED_FILTER_DROPDOWN_OFFSET}
    />
  );
};
