import { useFilteredObjectMetadataItems } from '@/object-metadata/hooks/useFilteredObjectMetadataItems';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContentWidthContainer';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { DropdownMenuSearchInput } from '@/ui/layout/dropdown/components/DropdownMenuSearchInput';
import { DropdownMenuSeparator } from '@/ui/layout/dropdown/components/DropdownMenuSeparator';
import { GenericDropdownContentWidth } from '@/ui/layout/dropdown/constants/GenericDropdownContentWidth';
import { SelectableList } from '@/ui/layout/selectable-list/components/SelectableList';
import { SelectableListItem } from '@/ui/layout/selectable-list/components/SelectableListItem';
import { useSelectableListStates } from '@/ui/layout/selectable-list/hooks/internal/useSelectableListStates';
import { useState } from 'react';
import { useRecoilValue } from 'recoil';
import { MenuItem, useIcons } from 'twenty-ui';

type WorkflowObjectDropdownContentProps = {
  dropdownId: string;
  onOptionClick: (value: string) => void;
};

export const WorkflowObjectDropdownContent = ({
  dropdownId,
  onOptionClick,
}: WorkflowObjectDropdownContentProps) => {
  const [searchInputValue, setSearchInputValue] = useState('');
  const { getIcon } = useIcons();

  const { objectMetadataItems } = useFilteredObjectMetadataItems();
  const nonSystemObjectMetadataItems = objectMetadataItems.filter(
    (objectMetadataItem) =>
      objectMetadataItem.isActive === true &&
      objectMetadataItem.isSystem === false,
  );
  const systemObjectMetadataItems = objectMetadataItems.filter(
    (objectMetadataItem) =>
      objectMetadataItem.isActive === true &&
      objectMetadataItem.isSystem === true,
  );

  const matchesSearchFilter = (
    objectMetadataItem: (typeof objectMetadataItems)[number],
    searchInputLowerCase: string,
  ) => {
    return (
      objectMetadataItem.nameSingular
        .toLowerCase()
        .includes(searchInputLowerCase) ||
      objectMetadataItem.labelSingular
        .toLowerCase()
        .includes(searchInputLowerCase) ||
      objectMetadataItem.labelPlural
        .toLowerCase()
        .includes(searchInputLowerCase)
    );
  };

  const searchInputLowerCase = searchInputValue.toLowerCase();

  const filteredNonSystemObjects = nonSystemObjectMetadataItems.filter(
    (objectMetadataItem) =>
      matchesSearchFilter(objectMetadataItem, searchInputLowerCase),
  );

  const filteredSystemObjects = systemObjectMetadataItems.filter(
    (objectMetadataItem) =>
      matchesSearchFilter(objectMetadataItem, searchInputLowerCase),
  );

  const filteredObjects = [
    ...filteredNonSystemObjects,
    ...filteredSystemObjects,
  ];

  const selectableItemIdArray = filteredObjects.map(
    (objectMetadataItem) => objectMetadataItem.nameSingular,
  );

  const { selectedItemIdState } = useSelectableListStates({
    selectableListScopeId: dropdownId,
  });
  const selectedItemId = useRecoilValue(selectedItemIdState);

  const handleSearchInputChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setSearchInputValue(event.target.value);
  };

  return (
    <DropdownContent widthInPixels={GenericDropdownContentWidth.ExtraLarge}>
      <DropdownMenuSearchInput
        autoFocus
        value={searchInputValue}
        onChange={handleSearchInputChange}
      />
      <DropdownMenuSeparator />
      <DropdownMenuItemsContainer hasMaxHeight>
        <SelectableList
          selectableListId={dropdownId}
          hotkeyScope={dropdownId}
          selectableItemIdArray={selectableItemIdArray}
          onEnter={onOptionClick}
        >
          {filteredObjects.map((objectMetadataItem) => (
            <SelectableListItem
              key={objectMetadataItem.nameSingular}
              itemId={objectMetadataItem.nameSingular}
            >
              <MenuItem
                focused={selectedItemId === objectMetadataItem.nameSingular}
                LeftIcon={getIcon(objectMetadataItem.icon)}
                text={objectMetadataItem.labelPlural}
                onClick={() => onOptionClick(objectMetadataItem.nameSingular)}
              />
            </SelectableListItem>
          ))}
        </SelectableList>
      </DropdownMenuItemsContainer>
    </DropdownContent>
  );
};
