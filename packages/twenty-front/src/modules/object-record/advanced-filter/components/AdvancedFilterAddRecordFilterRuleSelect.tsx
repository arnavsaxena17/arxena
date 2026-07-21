import { LightButton, MenuItem } from 'twenty-ui';
import { IconLibraryPlus, IconPlus } from 'twenty-ui/icons';
import { availableFieldMetadataItemsForFilterFamilySelector } from '@/object-metadata/states/availableFieldMetadataItemsForFilterFamilySelector';
import { FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { useChildRecordFiltersAndRecordFilterGroups } from '@/object-record/advanced-filter/hooks/useChildRecordFiltersAndRecordFilterGroups';
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
import { useDropdown } from '@/ui/layout/dropdown/hooks/useDropdown';
import { ViewFilterGroupLogicalOperator } from '@/views/types/ViewFilterGroupLogicalOperator';
import { t } from '@lingui/core/macro';
import { useContext } from 'react';
import { useRecoilCallback } from 'recoil';
import { getFilterTypeFromFieldType, isDefined } from 'twenty-shared';

import { v4 } from 'uuid';
import { ADVANCED_FILTER_DROPDOWN_ID } from '@/views/constants/AdvancedFilterDropdownId';

type AdvancedFilterAddRecordFilterRuleSelectProps = {
  recordFilterGroup: RecordFilterGroup;
};

const getDefaultFieldMetadataItemForFilterFromSnapshot = ({
  labelIdentifierFieldMetadataId,
  availableFieldMetadataItemsForFilter,
}: {
  labelIdentifierFieldMetadataId?: string | null;
  availableFieldMetadataItemsForFilter: FieldMetadataItem[];
}): FieldMetadataItem | undefined => {
  const fieldMetadataItemForLabelIdentifier =
    availableFieldMetadataItemsForFilter.find(
      (fieldMetadataItem) =>
        fieldMetadataItem.id === labelIdentifierFieldMetadataId,
    );

  return fieldMetadataItemForLabelIdentifier ?? availableFieldMetadataItemsForFilter[0];
};

const buildDefaultRecordFilter = ({
  defaultFieldMetadataItemForFilter,
  recordFilterGroupId,
  positionInRecordFilterGroup,
}: {
  defaultFieldMetadataItemForFilter: FieldMetadataItem;
  recordFilterGroupId: string;
  positionInRecordFilterGroup: number;
}): RecordFilter => {
  const filterType = getFilterTypeFromFieldType(
    defaultFieldMetadataItemForFilter.type,
  );

  const defaultSubFieldName =
    getDefaultSubFieldNameForCompositeFilterableFieldType(filterType);

  return {
    id: v4(),
    fieldMetadataId: defaultFieldMetadataItemForFilter.id,
    type: filterType,
    operand: getDefaultAdvancedFilterOperand({ filterType }),
    value: '',
    displayValue: '',
    recordFilterGroupId,
    positionInRecordFilterGroup,
    label: defaultFieldMetadataItemForFilter.label,
    subFieldName: defaultSubFieldName,
  };
};

export const AdvancedFilterAddRecordFilterRuleSelect = ({
  recordFilterGroup,
}: AdvancedFilterAddRecordFilterRuleSelectProps) => {
  const dropdownId = getAdvancedFilterAddFilterRuleSelectDropdownId(
    recordFilterGroup.id,
  );

  const { closeDropdown } = useDropdown(dropdownId);
  const { upsertRecordFilterGroup } = useUpsertRecordFilterGroup();
  const { upsertRecordFilter } = useUpsertRecordFilter();
  const { setRecordFilterUsedInAdvancedFilterDropdownRow } =
    useSetRecordFilterUsedInAdvancedFilterDropdownRow();
  const { objectMetadataItem } = useContext(AdvancedFilterContext);

  const { lastChildPosition } = useChildRecordFiltersAndRecordFilterGroups({
    recordFilterGroupId: recordFilterGroup.id,
  });

  const newPositionInRecordFilterGroup = lastChildPosition + 1;

  const handleAddFilter = useRecoilCallback(
    ({ snapshot }) =>
      () => {
        const availableFieldMetadataItemsForFilter = snapshot
          .getLoadable(
            availableFieldMetadataItemsForFilterFamilySelector({
              objectMetadataItemId: objectMetadataItem.id,
            }),
          )
          .getValue();

        const defaultFieldMetadataItemForFilter =
          getDefaultFieldMetadataItemForFilterFromSnapshot({
            labelIdentifierFieldMetadataId:
              objectMetadataItem.labelIdentifierFieldMetadataId,
            availableFieldMetadataItemsForFilter,
          });

        if (!isDefined(defaultFieldMetadataItemForFilter)) {
          return;
        }

        closeDropdown();

        const newRecordFilter = buildDefaultRecordFilter({
          defaultFieldMetadataItemForFilter,
          recordFilterGroupId: recordFilterGroup.id,
          positionInRecordFilterGroup: newPositionInRecordFilterGroup,
        });

        upsertRecordFilter(newRecordFilter);
        setRecordFilterUsedInAdvancedFilterDropdownRow(newRecordFilter);
      },
    [
      closeDropdown,
      newPositionInRecordFilterGroup,
      objectMetadataItem.id,
      objectMetadataItem.labelIdentifierFieldMetadataId,
      recordFilterGroup.id,
      setRecordFilterUsedInAdvancedFilterDropdownRow,
      upsertRecordFilter,
    ],
  );

  const handleAddFilterGroup = useRecoilCallback(
    ({ snapshot }) =>
      () => {
        const availableFieldMetadataItemsForFilter = snapshot
          .getLoadable(
            availableFieldMetadataItemsForFilterFamilySelector({
              objectMetadataItemId: objectMetadataItem.id,
            }),
          )
          .getValue();

        const defaultFieldMetadataItemForFilter =
          getDefaultFieldMetadataItemForFilterFromSnapshot({
            labelIdentifierFieldMetadataId:
              objectMetadataItem.labelIdentifierFieldMetadataId,
            availableFieldMetadataItemsForFilter,
          });

        if (!isDefined(defaultFieldMetadataItemForFilter)) {
          return;
        }

        closeDropdown();

        const newRecordFilterGroupId = v4();

        const newRecordFilterGroup: RecordFilterGroup = {
          id: newRecordFilterGroupId,
          logicalOperator: ViewFilterGroupLogicalOperator.AND,
          parentRecordFilterGroupId: recordFilterGroup.id,
          positionInRecordFilterGroup: newPositionInRecordFilterGroup,
        };

        upsertRecordFilterGroup(newRecordFilterGroup);

        const newRecordFilter = buildDefaultRecordFilter({
          defaultFieldMetadataItemForFilter,
          recordFilterGroupId: newRecordFilterGroupId,
          positionInRecordFilterGroup: 1,
        });

        upsertRecordFilter(newRecordFilter);
        setRecordFilterUsedInAdvancedFilterDropdownRow(newRecordFilter);
      },
    [
      closeDropdown,
      newPositionInRecordFilterGroup,
      objectMetadataItem.id,
      objectMetadataItem.labelIdentifierFieldMetadataId,
      recordFilterGroup.id,
      setRecordFilterUsedInAdvancedFilterDropdownRow,
      upsertRecordFilter,
      upsertRecordFilterGroup,
    ],
  );

  const isFilterRuleGroupOptionVisible = !isDefined(
    recordFilterGroup.parentRecordFilterGroupId,
  );

  if (!isFilterRuleGroupOptionVisible) {
    return (
      <LightButton
        Icon={IconPlus}
        title={t`Add rule`}
        onClick={handleAddFilter}
      />
    );
  }

  return (
    <Dropdown
      dropdownId={dropdownId}
      dropdownHotkeyScope={{ scope: ADVANCED_FILTER_DROPDOWN_ID }}
      clickableComponent={
        <LightButton Icon={IconPlus} title={t`Add filter rule`} />
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
