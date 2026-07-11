import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { isManyToOneRelationField } from '@/object-metadata/utils/isManyToOneRelationField';
import { isCompositeField } from '@/object-record/object-filter-dropdown/utils/isCompositeField';
import { getFilterTypeFromFieldType } from '@/object-metadata/utils/formatFieldMetadataItemsAsFilterDefinitions';
import { useSelectableList } from '@/ui/layout/selectable-list/hooks/useSelectableList';
import { useRecoilValue } from 'recoil';
import { MenuItemSelect, useIcons } from 'twenty-ui';

type AdvancedFilterFieldSelectMenuItemProps = {
  fieldMetadataItemToSelect: FieldMetadataItem;
  onClick: (selectedFieldMetadataItem: FieldMetadataItem) => void;
};

export const AdvancedFilterFieldSelectMenuItem = ({
  fieldMetadataItemToSelect,
  onClick,
}: AdvancedFilterFieldSelectMenuItemProps) => {
  const { isSelectedItemIdSelector, resetSelectedItem } = useSelectableList();

  const isSelectedItem = useRecoilValue(
    isSelectedItemIdSelector(fieldMetadataItemToSelect.id),
  );

  const { getIcon } = useIcons();

  const Icon = getIcon(fieldMetadataItemToSelect.icon);

  const filterType = getFilterTypeFromFieldType(fieldMetadataItemToSelect.type);

  const shouldShowSubMenu =
    isCompositeField(filterType) ||
    isManyToOneRelationField(fieldMetadataItemToSelect);

  const handleClick = () => {
    resetSelectedItem();
    onClick(fieldMetadataItemToSelect);
  };

  return (
    <MenuItemSelect
      selected={false}
      hovered={isSelectedItem}
      onClick={handleClick}
      LeftIcon={Icon}
      text={fieldMetadataItemToSelect.label}
      hasSubMenu={shouldShowSubMenu}
    />
  );
};
