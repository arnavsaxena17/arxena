import { useIcons } from 'twenty-ui';
import { IconChevronLeft } from 'twenty-ui/icons';
import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { isManyToOneRelationField } from '@/object-metadata/utils/isManyToOneRelationField';
import { useAdvancedFilterFieldSelectDropdown } from '@/object-record/advanced-filter/hooks/useAdvancedFilterFieldSelectDropdown';
import { useApplyAdvancedFilterRelationTargetField } from '@/object-record/advanced-filter/hooks/useApplyAdvancedFilterRelationTargetField';
import { usePushFocusForLeafFieldValuePicker } from '@/object-record/advanced-filter/hooks/usePushFocusForLeafFieldValuePicker';
import { fieldMetadataItemUsedInDropdownComponentSelector } from '@/object-record/object-filter-dropdown/states/fieldMetadataItemUsedInDropdownComponentSelector';
import { objectFilterDropdownIsSelectingRelationTargetFieldComponentState } from '@/object-record/object-filter-dropdown/states/objectFilterDropdownIsSelectingRelationTargetFieldComponentState';
import { useFilterableFieldMetadataItems } from '@/object-record/record-filter/hooks/useFilterableFieldMetadataItems';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContentWidthContainer';
import { DropdownMenuHeader } from '@/ui/layout/dropdown/components/DropdownMenuHeader/DropdownMenuHeader';
import { DropdownMenuHeaderLeftComponent } from '@/ui/layout/dropdown/components/DropdownMenuHeader/internal/DropdownMenuHeaderLeftComponent';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { GenericDropdownContentWidth } from '@/ui/layout/dropdown/constants/GenericDropdownContentWidth';
import { SelectableList } from '@/ui/layout/selectable-list/components/SelectableList';
import { SelectableListItem } from '@/ui/layout/selectable-list/components/SelectableListItem';
import { useSelectableListStates } from '@/ui/layout/selectable-list/hooks/internal/useSelectableListStates';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useSetRecoilComponentStateV2 } from '@/ui/utilities/state/component-state/hooks/useSetRecoilComponentStateV2';
import { useRecoilValue } from 'recoil';
import { isDefined } from 'twenty-shared';

import { MenuItem } from 'twenty-ui';

type AdvancedFilterRelationTargetFieldSelectMenuProps = {
  recordFilterId: string;
};

export const AdvancedFilterRelationTargetFieldSelectMenu = ({
  recordFilterId,
}: AdvancedFilterRelationTargetFieldSelectMenuProps) => {
  const { getIcon } = useIcons();

  const sourceFieldMetadataItem = useRecoilComponentValueV2(
    fieldMetadataItemUsedInDropdownComponentSelector,
  );

  const setObjectFilterDropdownIsSelectingRelationTargetField =
    useSetRecoilComponentStateV2(
      objectFilterDropdownIsSelectingRelationTargetFieldComponentState,
    );

  const { closeAdvancedFilterFieldSelectDropdown } =
    useAdvancedFilterFieldSelectDropdown(recordFilterId);

  const { applyAdvancedFilterRelationTargetField } =
    useApplyAdvancedFilterRelationTargetField();

  const { pushFocusForLeafFieldValuePicker } =
    usePushFocusForLeafFieldValuePicker();

  const { advancedFilterFieldSelectDropdownId } =
    useAdvancedFilterFieldSelectDropdown(recordFilterId);

  const { selectedItemIdState } = useSelectableListStates({
    selectableListScopeId: advancedFilterFieldSelectDropdownId,
  });
  const selectedItemId = useRecoilValue(selectedItemIdState);

  const targetObjectMetadataId =
    isDefined(sourceFieldMetadataItem) &&
    isManyToOneRelationField(sourceFieldMetadataItem)
      ? sourceFieldMetadataItem.relationDefinition.targetObjectMetadata.id
      : null;

  const { filterableFieldMetadataItems: relationTargetFields } =
    useFilterableFieldMetadataItems(targetObjectMetadataId ?? '');

  if (
    !isDefined(sourceFieldMetadataItem) ||
    !isManyToOneRelationField(sourceFieldMetadataItem)
  ) {
    return null;
  }

  const handleSubMenuBack = () => {
    setObjectFilterDropdownIsSelectingRelationTargetField(false);
  };

  const handleSelectTargetField = (
    relationTargetFieldMetadataItem: FieldMetadataItem,
  ) => {
    applyAdvancedFilterRelationTargetField({
      sourceFieldMetadataItem,
      relationTargetFieldMetadataItem,
      recordFilterId,
    });

    pushFocusForLeafFieldValuePicker(relationTargetFieldMetadataItem);

    setObjectFilterDropdownIsSelectingRelationTargetField(false);
    closeAdvancedFilterFieldSelectDropdown();
  };

  const selectableItemIdArray = relationTargetFields.map((field) => field.id);

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
        {sourceFieldMetadataItem.label}
      </DropdownMenuHeader>
      <DropdownMenuItemsContainer>
        <SelectableList
          hotkeyScope={advancedFilterFieldSelectDropdownId}
          selectableItemIdArray={selectableItemIdArray}
          selectableListId={advancedFilterFieldSelectDropdownId}
          onEnter={(itemId) => {
            const targetField = relationTargetFields.find(
              (field) => field.id === itemId,
            );

            if (!isDefined(targetField)) {
              return;
            }

            handleSelectTargetField(targetField);
          }}
        >
          {relationTargetFields.map((targetField, index) => (
            <SelectableListItem
              itemId={targetField.id}
              key={`select-filter-relation-${index}`}
            >
              <MenuItem
                focused={selectedItemId === targetField.id}
                key={`select-filter-relation-${index}`}
                testId={`select-filter-relation-${index}`}
                onClick={() => {
                  handleSelectTargetField(targetField);
                }}
                text={targetField.label}
                LeftIcon={getIcon(targetField.icon)}
              />
            </SelectableListItem>
          ))}
        </SelectableList>
      </DropdownMenuItemsContainer>
    </DropdownContent>
  );
};
