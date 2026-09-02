import { useAdvancedFilterFieldSelectDropdown } from '@/object-record/advanced-filter/hooks/useAdvancedFilterFieldSelectDropdown';
import { useApplyAdvancedFilterCompositeSubField } from '@/object-record/advanced-filter/hooks/useApplyAdvancedFilterCompositeSubField';
import { fieldMetadataItemUsedInDropdownComponentSelector } from '@/object-record/object-filter-dropdown/states/fieldMetadataItemUsedInDropdownComponentSelector';
import { objectFilterDropdownIsSelectingRawJsonPathComponentState } from '@/object-record/object-filter-dropdown/states/objectFilterDropdownIsSelectingRawJsonPathComponentState';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { DropdownMenuHeader } from '@/ui/layout/dropdown/components/DropdownMenuHeader/DropdownMenuHeader';
import { DropdownMenuHeaderLeftComponent } from '@/ui/layout/dropdown/components/DropdownMenuHeader/internal/DropdownMenuHeaderLeftComponent';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { DropdownMenuSearchInput } from '@/ui/layout/dropdown/components/DropdownMenuSearchInput';
import { DropdownMenuSeparator } from '@/ui/layout/dropdown/components/DropdownMenuSeparator';
import { GenericDropdownContentWidth } from '@/ui/layout/dropdown/constants/GenericDropdownContentWidth';
import { SelectableList } from '@/ui/layout/selectable-list/components/SelectableList';
import { SelectableListItem } from '@/ui/layout/selectable-list/components/SelectableListItem';
import { selectedItemIdComponentState } from '@/ui/layout/selectable-list/states/selectedItemIdComponentState';
import { useAtomComponentSelectorValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentSelectorValue';
import { useAtomComponentState } from '@/ui/utilities/state/jotai/hooks/useAtomComponentState';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { t } from '@lingui/core/macro';
import { useMemo, useState } from 'react';
import {
  getKnownRawJsonPathKeysForField,
  isAllowedRawJsonPathKey,
  isDefined,
} from 'twenty-shared/utils';
import { IconChevronLeft } from 'twenty-ui/icon';
import { MenuItem, MenuItemSelect } from 'twenty-ui/navigation';
import { filterBySearchQuery } from '~/utils/filterBySearchQuery';

type AdvancedFilterRawJsonPathSelectMenuProps = {
  recordFilterId: string;
};

export const AdvancedFilterRawJsonPathSelectMenu = ({
  recordFilterId,
}: AdvancedFilterRawJsonPathSelectMenuProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [customPathInput, setCustomPathInput] = useState('');

  const fieldMetadataItemUsedInDropdown = useAtomComponentSelectorValue(
    fieldMetadataItemUsedInDropdownComponentSelector,
  );

  const [, setObjectFilterDropdownIsSelectingRawJsonPath] =
    useAtomComponentState(
      objectFilterDropdownIsSelectingRawJsonPathComponentState,
    );

  const { closeAdvancedFilterFieldSelectDropdown } =
    useAdvancedFilterFieldSelectDropdown(recordFilterId);

  const { applyAdvancedFilterCompositeSubField } =
    useApplyAdvancedFilterCompositeSubField();

  const { advancedFilterFieldSelectDropdownId } =
    useAdvancedFilterFieldSelectDropdown(recordFilterId);

  const selectedItemId = useAtomComponentStateValue(
    selectedItemIdComponentState,
    advancedFilterFieldSelectDropdownId,
  );

  const knownPathKeys = useMemo(
    () =>
      getKnownRawJsonPathKeysForField(
        fieldMetadataItemUsedInDropdown?.name ?? '',
      ) ?? [],
    [fieldMetadataItemUsedInDropdown?.name],
  );

  const filteredKnownPathKeys = useMemo(
    () =>
      filterBySearchQuery({
        items: [...knownPathKeys],
        searchQuery,
        getSearchableValues: (pathKey) => [pathKey],
      }),
    [knownPathKeys, searchQuery],
  );

  const trimmedCustomPathInput = customPathInput.trim();
  const canUseCustomPath =
    trimmedCustomPathInput.length > 0 &&
    isAllowedRawJsonPathKey(trimmedCustomPathInput);

  const handleSubMenuBack = () => {
    setObjectFilterDropdownIsSelectingRawJsonPath(false);
  };

  const handleSelectPath = (pathKey: string) => {
    if (!isDefined(fieldMetadataItemUsedInDropdown)) {
      return;
    }

    applyAdvancedFilterCompositeSubField({
      sourceFieldMetadataItem: fieldMetadataItemUsedInDropdown,
      subFieldName: pathKey,
      recordFilterId,
    });

    setObjectFilterDropdownIsSelectingRawJsonPath(false);
    closeAdvancedFilterFieldSelectDropdown();
  };

  const handleSelectWholeField = () => {
    if (!isDefined(fieldMetadataItemUsedInDropdown)) {
      return;
    }

    applyAdvancedFilterCompositeSubField({
      sourceFieldMetadataItem: fieldMetadataItemUsedInDropdown,
      subFieldName: null,
      recordFilterId,
    });

    setObjectFilterDropdownIsSelectingRawJsonPath(false);
    closeAdvancedFilterFieldSelectDropdown();
  };

  if (!isDefined(fieldMetadataItemUsedInDropdown)) {
    return null;
  }

  const selectableItemIdArray = [
    'whole-field',
    ...filteredKnownPathKeys,
    ...(canUseCustomPath ? ['custom-path'] : []),
  ];

  return (
    <DropdownContent widthInPixels={GenericDropdownContentWidth.ExtraLarge}>
      <DropdownMenuHeader
        StartComponent={
          <DropdownMenuHeaderLeftComponent
            onClick={handleSubMenuBack}
            Icon={IconChevronLeft}
          />
        }
      >
        {fieldMetadataItemUsedInDropdown.label}
      </DropdownMenuHeader>
      <DropdownMenuSearchInput
        autoFocus
        type="text"
        placeholder={t`Search JSON keys`}
        onChange={(event) => setSearchQuery(event.target.value)}
        value={searchQuery}
      />
      <DropdownMenuSeparator />
      <DropdownMenuItemsContainer>
        <SelectableList
          focusId={advancedFilterFieldSelectDropdownId}
          selectableItemIdArray={selectableItemIdArray}
          selectableListInstanceId={advancedFilterFieldSelectDropdownId}
        >
          <SelectableListItem
            itemId="whole-field"
            onEnter={handleSelectWholeField}
          >
            <MenuItem
              focused={selectedItemId === 'whole-field'}
              onClick={handleSelectWholeField}
              text={t`Entire JSON field`}
            />
          </SelectableListItem>
          {filteredKnownPathKeys.map((pathKey) => (
            <SelectableListItem
              key={pathKey}
              itemId={pathKey}
              onEnter={() => handleSelectPath(pathKey)}
            >
              <MenuItemSelect
                text={pathKey}
                selected={false}
                focused={selectedItemId === pathKey}
                onClick={() => handleSelectPath(pathKey)}
              />
            </SelectableListItem>
          ))}
        </SelectableList>
      </DropdownMenuItemsContainer>
      {knownPathKeys.length === 0 && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuSearchInput
            type="text"
            placeholder={t`Custom JSON key`}
            onChange={(event) => setCustomPathInput(event.target.value)}
            value={customPathInput}
          />
          <DropdownMenuItemsContainer>
            <MenuItemSelect
              text={t`Use custom key`}
              disabled={!canUseCustomPath}
              onClick={() => {
                if (canUseCustomPath) {
                  handleSelectPath(trimmedCustomPathInput);
                }
              }}
            />
          </DropdownMenuItemsContainer>
        </>
      )}
    </DropdownContent>
  );
};
