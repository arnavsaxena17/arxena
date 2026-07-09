import { DEFAULT_ADVANCED_FILTER_DROPDOWN_OFFSET } from '@/object-record/advanced-filter/constants/DefaultAdvancedFilterDropdownOffset';
import { AdvancedFilterContext } from '@/object-record/advanced-filter/states/context/AdvancedFilterContext';
import { useApplyObjectFilterDropdownOperand } from '@/object-record/object-filter-dropdown/hooks/useApplyObjectFilterDropdownOperand';

import { getOperandLabel } from '@/object-record/object-filter-dropdown/utils/getOperandLabel';
import { useTimeZoneAbbreviationForNowInUserTimeZone } from '@/object-record/record-filter/hooks/useTimeZoneAbbreviationForNowInUserTimeZone';
import { type RecordFilter } from '@/object-record/record-filter/types/RecordFilter';
import { type RecordFilterOperand } from '@/object-record/record-filter/types/RecordFilterOperand';
import { useUserTimezone } from '@/ui/input/components/internal/date/hooks/useUserTimezone';
import { SelectControl } from '@/ui/input/components/SelectControl';
import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContentWidthContainer';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { GenericDropdownContentWidth } from '@/ui/layout/dropdown/constants/GenericDropdownContentWidth';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { SelectableList } from '@/ui/layout/selectable-list/components/SelectableList';
import { SelectableListItem } from '@/ui/layout/selectable-list/components/SelectableListItem';
import { useSelectableListStates } from '@/ui/layout/selectable-list/hooks/internal/useSelectableListStates';
import { t } from '@lingui/core/macro';
import { useContext } from 'react';
import { useRecoilValue } from 'recoil';
import { MenuItem } from 'twenty-ui';
import { ADVANCED_FILTER_DROPDOWN_ID } from '@/views/constants/AdvancedFilterDropdownId';

type AdvancedFilterRecordFilterOperandSelectContentProps = {
  recordFilterId: string;
  filter: RecordFilter;
  operandsForFilterType: readonly RecordFilterOperand[];
};

export const AdvancedFilterRecordFilterOperandSelectContent = ({
  recordFilterId,
  filter,
  operandsForFilterType,
}: AdvancedFilterRecordFilterOperandSelectContentProps) => {
  const dropdownId = `advanced-filter-view-filter-operand-${recordFilterId}`;

  const { isWorkflowFindRecords } = useContext(AdvancedFilterContext);

  const { closeDropdown } = useCloseDropdown();

  const { applyObjectFilterDropdownOperand } =
    useApplyObjectFilterDropdownOperand();

  const handleOperandChange = (operand: RecordFilterOperand) => {
    closeDropdown(dropdownId);

    applyObjectFilterDropdownOperand(operand);
  };

  const { selectedItemIdState } = useSelectableListStates({
    selectableListScopeId: dropdownId,
  });
  const selectedItemId = useRecoilValue(selectedItemIdState);

  const { userTimeZoneAbbreviation } =
    useTimeZoneAbbreviationForNowInUserTimeZone();

  const { isSystemTimezone } = useUserTimezone();

  const timeZoneAbbreviation =
    isWorkflowFindRecords === true
      ? 'UTC'
      : !isSystemTimezone
        ? userTimeZoneAbbreviation
        : null;

  return (
    <Dropdown
      dropdownId={dropdownId}
      dropdownHotkeyScope={{ scope: ADVANCED_FILTER_DROPDOWN_ID }}
      clickableComponent={
        <SelectControl
          selectedOption={{
            label: filter?.operand
              ? getOperandLabel(filter.operand, timeZoneAbbreviation)
              : t`Select operand`,
            value: null,
          }}
        />
      }
      dropdownComponents={
        <DropdownContent widthInPixels={GenericDropdownContentWidth.Narrow}>
          <DropdownMenuItemsContainer>
            <SelectableList
              hotkeyScope={dropdownId}
              selectableItemIdArray={operandsForFilterType.map(
                (operand) => operand,
              )}
              selectableListId={dropdownId}
              onEnter={(itemId) => {
                handleOperandChange(itemId as RecordFilterOperand);
              }}
            >
              {operandsForFilterType.map((filterOperand, index) => (
                <SelectableListItem
                  itemId={filterOperand}
                  key={`select-filter-operand-${index}`}
                >
                  <MenuItem
                    focused={selectedItemId === filterOperand}
                    onClick={() => {
                      handleOperandChange(filterOperand);
                    }}
                    text={getOperandLabel(filterOperand, timeZoneAbbreviation)}
                  />
                </SelectableListItem>
              ))}
            </SelectableList>
          </DropdownMenuItemsContainer>
        </DropdownContent>
      }
      dropdownOffset={DEFAULT_ADVANCED_FILTER_DROPDOWN_OFFSET}
      dropdownPlacement="bottom-start"
    />
  );
};
