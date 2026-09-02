import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { DropdownMenuHeader } from '@/ui/layout/dropdown/components/DropdownMenuHeader/DropdownMenuHeader';
import { DropdownMenuHeaderLeftComponent } from '@/ui/layout/dropdown/components/DropdownMenuHeader/internal/DropdownMenuHeaderLeftComponent';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { DropdownMenuSearchInput } from '@/ui/layout/dropdown/components/DropdownMenuSearchInput';
import { DropdownMenuSeparator } from '@/ui/layout/dropdown/components/DropdownMenuSeparator';
import { DropdownComponentInstanceContext } from '@/ui/layout/dropdown/contexts/DropdownComponentInstanceContext';
import { SelectableList } from '@/ui/layout/selectable-list/components/SelectableList';
import { SelectableListItem } from '@/ui/layout/selectable-list/components/SelectableListItem';
import { selectedItemIdComponentState } from '@/ui/layout/selectable-list/states/selectedItemIdComponentState';
import { useAvailableComponentInstanceIdOrThrow } from '@/ui/utilities/state/component-state/hooks/useAvailableComponentInstanceIdOrThrow';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { t } from '@lingui/core/macro';
import { useMemo, useState } from 'react';
import {
  getKnownRawJsonPathKeysForField,
  isAllowedRawJsonPathKey,
} from 'twenty-shared/utils';
import { IconChevronLeft } from 'twenty-ui/icon';
import { MenuItemSelect } from 'twenty-ui/navigation';
import { filterBySearchQuery } from '~/utils/filterBySearchQuery';

type ChartGroupByFieldSelectionRawJsonFieldViewProps = {
  rawJsonField: FieldMetadataItem;
  currentSubFieldName: string | undefined;
  onBack: () => void;
  onSelectSubField: (subFieldName: string) => void;
};

export const ChartGroupByFieldSelectionRawJsonFieldView = ({
  rawJsonField,
  currentSubFieldName,
  onBack,
  onSelectSubField,
}: ChartGroupByFieldSelectionRawJsonFieldViewProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [customPathInput, setCustomPathInput] = useState('');

  const dropdownId = useAvailableComponentInstanceIdOrThrow(
    DropdownComponentInstanceContext,
  );

  const selectedItemId = useAtomComponentStateValue(
    selectedItemIdComponentState,
    dropdownId,
  );

  const knownPathKeys = getKnownRawJsonPathKeysForField(rawJsonField.name) ?? [];

  const filteredKnownPathKeys = useMemo(
    () =>
      filterBySearchQuery({
        items: [...knownPathKeys],
        searchQuery,
        getSearchableValues: (item) => [item],
      }),
    [knownPathKeys, searchQuery],
  );

  const trimmedCustomPathInput = customPathInput.trim();
  const canUseCustomPath =
    trimmedCustomPathInput.length > 0 &&
    isAllowedRawJsonPathKey(trimmedCustomPathInput);

  return (
    <>
      <DropdownMenuHeader
        StartComponent={
          <DropdownMenuHeaderLeftComponent onClick={onBack} Icon={IconChevronLeft} />
        }
      >
        {rawJsonField.label}
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
          selectableListInstanceId={dropdownId}
          focusId={dropdownId}
          selectableItemIdArray={filteredKnownPathKeys}
        >
          {filteredKnownPathKeys.map((pathKey) => (
            <SelectableListItem
              key={pathKey}
              itemId={pathKey}
              onEnter={() => {
                onSelectSubField(pathKey);
              }}
            >
              <MenuItemSelect
                text={pathKey}
                selected={currentSubFieldName === pathKey}
                focused={selectedItemId === pathKey}
                onClick={() => {
                  onSelectSubField(pathKey);
                }}
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
                  onSelectSubField(trimmedCustomPathInput);
                }
              }}
            />
          </DropdownMenuItemsContainer>
        </>
      )}
    </>
  );
};
