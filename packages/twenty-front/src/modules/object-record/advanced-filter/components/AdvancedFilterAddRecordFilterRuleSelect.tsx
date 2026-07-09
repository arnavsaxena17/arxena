import { CommandMenuButton } from '@/command-menu/components/CommandMenuButton';
import { useChildRecordFiltersAndRecordFilterGroups } from '@/object-record/advanced-filter/hooks/useChildRecordFiltersAndRecordFilterGroups';
import { useGetDefaultFieldMetadataItemForFilter } from '@/object-record/advanced-filter/hooks/useGetDefaultFieldMetadataItemForFilter';
import { useSetRecordFilterUsedInAdvancedFilterDropdownRow } from '@/object-record/advanced-filter/hooks/useSetRecordFilterUsedInAdvancedFilterDropdownRow';
import { AdvancedFilterContext } from '@/object-record/advanced-filter/states/context/AdvancedFilterContext';
import { getAdvancedFilterAddFilterRuleSelectDropdownId } from '@/object-record/advanced-filter/utils/getAdvancedFilterAddFilterRuleSelectDropdownId';
import { getDefaultAdvancedFilterOperand } from '@/object-record/advanced-filter/utils/getDefaultAdvancedFilterOperand';
import { useUpsertRecordFilterGroup } from '@/object-record/record-filter-group/hooks/useUpsertRecordFilterGroup';
import { RecordFilterGroup } from '@/object-record/record-filter-group/types/RecordFilterGroup';
import { useUpsertRecordFilter } from '@/object-record/record-filter/hooks/useUpsertRecordFilter';
import { RecordFilter } from '@/object-record/record-filter/types/RecordFilter';
import { getDefaultSubFieldNameForCompositeFilterableFieldType } from '@/object-record/record-filter/utils/getDefaultSubFieldNameForCompositeFilterableFieldType';
import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContentWidthContainer';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { ViewFilterGroupLogicalOperator } from '@/views/types/ViewFilterGroupLogicalOperator';
import { t } from '@lingui/core/macro';
import { useContext } from 'react';
import { getFilterTypeFromFieldType, isDefined } from 'twenty-shared';
import { IconLibraryPlus, IconPlus, MenuItem } from 'twenty-ui';
import { v4 } from 'uuid';
import { ADVANCED_FILTER_DROPDOWN_ID } from '@/views/constants/AdvancedFilterDropdownId';

type AdvancedFilterAddRecordFilterRuleSelectProps = {
  recordFilterGroup: RecordFilterGroup;
};

export const AdvancedFilterAddRecordFilterRuleSelect = ({
  recordFilterGroup,
}: AdvancedFilterAddRecordFilterRuleSelectProps) => {
  const dropdownId = getAdvancedFilterAddFilterRuleSelectDropdownId(
    recordFilterGroup.id,
  );

  const { upsertRecordFilterGroup } = useUpsertRecordFilterGroup();
  const { upsertRecordFilter } = useUpsertRecordFilter();

  const { lastChildPosition } = useChildRecordFiltersAndRecordFilterGroups({
    recordFilterGroupId: recordFilterGroup.id,
  });

  const newPositionInRecordFilterGroup = lastChildPosition + 1;
  const { closeDropdown } = useCloseDropdown();
  const { getDefaultFieldMetadataItemForFilter } =
    useGetDefaultFieldMetadataItemForFilter();
  const { setRecordFilterUsedInAdvancedFilterDropdownRow } =
    useSetRecordFilterUsedInAdvancedFilterDropdownRow();
  const { objectMetadataItem } = useContext(AdvancedFilterContext);

  const handleAddFilter = () => {
    const { defaultFieldMetadataItemForFilter } =
      getDefaultFieldMetadataItemForFilter(objectMetadataItem);

    if (!isDefined(defaultFieldMetadataItemForFilter)) {
      throw new Error('Missing default field metadata item for filter');
    }

    closeDropdown(dropdownId);

    const filterType = getFilterTypeFromFieldType(
      defaultFieldMetadataItemForFilter.type,
    );

    const defaultSubFieldName =
      getDefaultSubFieldNameForCompositeFilterableFieldType(filterType);

    const newRecordFilter: RecordFilter = {
      id: v4(),
      fieldMetadataId: defaultFieldMetadataItemForFilter.id,
      type: filterType,
      operand: getDefaultAdvancedFilterOperand({ filterType }),
      value: '',
      displayValue: '',
      recordFilterGroupId: recordFilterGroup.id,
      positionInRecordFilterGroup: newPositionInRecordFilterGroup,
      label: defaultFieldMetadataItemForFilter.label,
      subFieldName: defaultSubFieldName,
    };

    upsertRecordFilter(newRecordFilter);
    setRecordFilterUsedInAdvancedFilterDropdownRow(newRecordFilter);
  };

  const handleAddFilterGroup = () => {
    const { defaultFieldMetadataItemForFilter } =
      getDefaultFieldMetadataItemForFilter(objectMetadataItem);

    closeDropdown(dropdownId);

    if (!isDefined(defaultFieldMetadataItemForFilter)) {
      throw new Error('Missing default field metadata item for filter');
    }

    const newRecordFilterGroupId = v4();

    const newRecordFilterGroup: RecordFilterGroup = {
      id: newRecordFilterGroupId,
      logicalOperator: ViewFilterGroupLogicalOperator.AND,
      parentRecordFilterGroupId: recordFilterGroup.id,
      positionInRecordFilterGroup: newPositionInRecordFilterGroup,
    };

    upsertRecordFilterGroup(newRecordFilterGroup);

    const filterType = getFilterTypeFromFieldType(
      defaultFieldMetadataItemForFilter.type,
    );

    const newRecordFilter: RecordFilter = {
      id: v4(),
      fieldMetadataId: defaultFieldMetadataItemForFilter.id,
      type: filterType,
      operand: getDefaultAdvancedFilterOperand({ filterType }),
      value: '',
      displayValue: '',
      recordFilterGroupId: newRecordFilterGroupId,
      positionInRecordFilterGroup: 1,
      label: defaultFieldMetadataItemForFilter.label,
    };

    upsertRecordFilter(newRecordFilter);
    setRecordFilterUsedInAdvancedFilterDropdownRow(newRecordFilter);
  };

  const isFilterRuleGroupOptionVisible = !isDefined(
    recordFilterGroup.parentRecordFilterGroupId,
  );

  if (!isFilterRuleGroupOptionVisible) {
    return (
      <CommandMenuButton
        command={{
          Icon: IconPlus,
          label: t`Add rule`,
          shortLabel: t`Add rule`,
          key: 'add-rule',
        }}
        onClick={handleAddFilter}
      />
    );
  }

  return (
    <Dropdown
      dropdownId={dropdownId}
      dropdownHotkeyScope={{ scope: ADVANCED_FILTER_DROPDOWN_ID }}
      clickableComponent={
        <CommandMenuButton
          command={{
            Icon: IconPlus,
            label: t`Add filter rule`,
            shortLabel: t`Add filter rule`,
            key: 'add-filter-rule',
          }}
        />
      }
      dropdownComponents={
        <DropdownContent>
          <DropdownMenuItemsContainer>
            <MenuItem
              LeftIcon={IconPlus}
              text={t`Add rule`}
              onClick={handleAddFilter}
            />
            <MenuItem
              LeftIcon={IconLibraryPlus}
              text={t`Add rule group`}
              onClick={handleAddFilterGroup}
            />
          </DropdownMenuItemsContainer>
        </DropdownContent>
      }
      dropdownOffset={{ y: 8, x: 0 }}
      dropdownPlacement="bottom-start"
    />
  );
};
