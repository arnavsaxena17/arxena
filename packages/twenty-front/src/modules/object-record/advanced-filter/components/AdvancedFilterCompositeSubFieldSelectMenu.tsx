import { IconNameBySubField } from 'twenty-ui';
import { useIcons } from 'twenty-ui';
import { IconChevronLeft } from 'twenty-ui/icons';
import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { useAdvancedFilterFieldSelectDropdown } from '@/object-record/advanced-filter/hooks/useAdvancedFilterFieldSelectDropdown';
import { useApplyAdvancedFilterCompositeSubField } from '@/object-record/advanced-filter/hooks/useApplyAdvancedFilterCompositeSubField';
import { fieldMetadataItemUsedInDropdownComponentSelector } from '@/object-record/object-filter-dropdown/states/fieldMetadataItemUsedInDropdownComponentSelector';
import { objectFilterDropdownIsSelectingCompositeFieldComponentState } from '@/object-record/object-filter-dropdown/states/objectFilterDropdownIsSelectingCompositeFieldComponentState';
import { objectFilterDropdownSubMenuFieldTypeComponentState } from '@/object-record/object-filter-dropdown/states/objectFilterDropdownSubMenuFieldTypeComponentState';
import { getCompositeSubFieldLabel } from '@/object-record/object-filter-dropdown/utils/getCompositeSubFieldLabel';
import { ICON_NAME_BY_SUB_FIELD } from '@/object-record/record-filter/constants/IconNameBySubField';
import { areCompositeTypeSubFieldsFilterable } from '@/object-record/record-filter/utils/areCompositeTypeSubFieldsFilterable';
import { isCompositeTypeNonFilterableByAnySubField } from '@/object-record/record-filter/utils/isCompositeTypeNonFilterableByAnySubField';
import { SETTINGS_COMPOSITE_FIELD_TYPE_CONFIGS } from '@/settings/data-model/constants/SettingsCompositeFieldTypeConfigs';
import { type CompositeFieldSubFieldName } from '@/settings/data-model/types/CompositeFieldSubFieldName';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContentWidthContainer';
import { DropdownMenuHeader } from '@/ui/layout/dropdown/components/DropdownMenuHeader/DropdownMenuHeader';
import { DropdownMenuHeaderLeftComponent } from '@/ui/layout/dropdown/components/DropdownMenuHeader/internal/DropdownMenuHeaderLeftComponent';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { GenericDropdownContentWidth } from '@/ui/layout/dropdown/constants/GenericDropdownContentWidth';
import { SelectableList } from '@/ui/layout/selectable-list/components/SelectableList';
import { SelectableListItem } from '@/ui/layout/selectable-list/components/SelectableListItem';
import { useSelectableListStates } from '@/ui/layout/selectable-list/hooks/internal/useSelectableListStates';
import { useRecoilComponentStateV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentStateV2';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { t } from '@lingui/core/macro';
import { useRecoilValue } from 'recoil';
import { isDefined } from 'twenty-shared';

import { MenuItem } from 'twenty-ui';

type AdvancedFilterCompositeSubFieldSelectMenuProps = {
  recordFilterId: string;
};

export const AdvancedFilterCompositeSubFieldSelectMenu = ({
  recordFilterId,
}: AdvancedFilterCompositeSubFieldSelectMenuProps) => {
  const { getIcon } = useIcons();

  const fieldMetadataItemUsedInDropdown = useRecoilComponentValueV2(
    fieldMetadataItemUsedInDropdownComponentSelector,
  );

  const [, setObjectFilterDropdownIsSelectingCompositeField] =
    useRecoilComponentStateV2(
      objectFilterDropdownIsSelectingCompositeFieldComponentState,
    );

  const [
    objectFilterDropdownSubMenuFieldType,
    setObjectFilterDropdownSubMenuFieldType,
  ] = useRecoilComponentStateV2(objectFilterDropdownSubMenuFieldTypeComponentState);

  const { closeAdvancedFilterFieldSelectDropdown } =
    useAdvancedFilterFieldSelectDropdown(recordFilterId);

  const { applyAdvancedFilterCompositeSubField } =
    useApplyAdvancedFilterCompositeSubField();

  const handleSelectFilter = ({
    fieldMetadataItem,
    subFieldName,
  }: {
    fieldMetadataItem: FieldMetadataItem;
    subFieldName?: CompositeFieldSubFieldName | null;
  }) => {
    applyAdvancedFilterCompositeSubField({
      sourceFieldMetadataItem: fieldMetadataItem,
      subFieldName: subFieldName ?? null,
      recordFilterId,
    });

    closeAdvancedFilterFieldSelectDropdown();
  };

  const handleSubMenuBack = () => {
    setObjectFilterDropdownSubMenuFieldType(null);
    setObjectFilterDropdownIsSelectingCompositeField(false);
  };

  const { advancedFilterFieldSelectDropdownId } =
    useAdvancedFilterFieldSelectDropdown(recordFilterId);

  const { selectedItemIdState } = useSelectableListStates({
    selectableListScopeId: advancedFilterFieldSelectDropdownId,
  });
  const selectedItemId = useRecoilValue(selectedItemIdState);

  if (!isDefined(objectFilterDropdownSubMenuFieldType)) {
    return null;
  }

  const subFieldNames = SETTINGS_COMPOSITE_FIELD_TYPE_CONFIGS[
    objectFilterDropdownSubMenuFieldType
  ].subFields
    .filter((subField) => subField.isFilterable === true)
    .map((subField) => subField.subFieldName);

  const subFieldsAreFilterable =
    isDefined(fieldMetadataItemUsedInDropdown) &&
    areCompositeTypeSubFieldsFilterable(fieldMetadataItemUsedInDropdown.type);

  const compositeFieldTypeIsFilterableByAnySubField =
    isDefined(fieldMetadataItemUsedInDropdown) &&
    !isCompositeTypeNonFilterableByAnySubField(
      fieldMetadataItemUsedInDropdown.type,
    );

  const selectableItemIdArray = [
    '-1',
    ...subFieldNames.map((subFieldName) => subFieldName),
  ];

  const fieldLabel = fieldMetadataItemUsedInDropdown?.label;

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
        {fieldMetadataItemUsedInDropdown?.label}
      </DropdownMenuHeader>
      <DropdownMenuItemsContainer>
        <SelectableList
          hotkeyScope={advancedFilterFieldSelectDropdownId}
          selectableItemIdArray={selectableItemIdArray}
          selectableListId={advancedFilterFieldSelectDropdownId}
          onEnter={(itemId) => {
            if (!isDefined(fieldMetadataItemUsedInDropdown)) {
              return;
            }

            if (itemId === '-1') {
              handleSelectFilter({
                fieldMetadataItem: fieldMetadataItemUsedInDropdown,
              });
              return;
            }

            handleSelectFilter({
              fieldMetadataItem: fieldMetadataItemUsedInDropdown,
              subFieldName: itemId as CompositeFieldSubFieldName,
            });
          }}
        >
          {compositeFieldTypeIsFilterableByAnySubField &&
            isDefined(fieldMetadataItemUsedInDropdown) && (
              <SelectableListItem
                itemId="-1"
                key={`select-filter-${-1}`}
              >
                <MenuItem
                  key={`select-filter-${-1}`}
                  testId={`select-filter-${-1}`}
                  focused={selectedItemId === '-1'}
                  onClick={() => {
                    handleSelectFilter({
                      fieldMetadataItem: fieldMetadataItemUsedInDropdown,
                    });
                  }}
                  LeftIcon={getIcon(fieldMetadataItemUsedInDropdown.icon)}
                  text={t`Any ${fieldLabel ?? ''} field`}
                />
              </SelectableListItem>
            )}
          {subFieldsAreFilterable &&
            isDefined(fieldMetadataItemUsedInDropdown) &&
            subFieldNames.map((subFieldName, index) => (
              <SelectableListItem
                itemId={subFieldName}
                key={`select-filter-${index}`}
              >
                <MenuItem
                  focused={selectedItemId === subFieldName}
                  key={`select-filter-${index}`}
                  testId={`select-filter-${index}`}
                  onClick={() => {
                    handleSelectFilter({
                      fieldMetadataItem: fieldMetadataItemUsedInDropdown,
                      subFieldName,
                    });
                  }}
                  text={getCompositeSubFieldLabel(
                    objectFilterDropdownSubMenuFieldType,
                    subFieldName,
                  )}
                  LeftIcon={getIcon(
                    ICON_NAME_BY_SUB_FIELD[subFieldName] ??
                      fieldMetadataItemUsedInDropdown.icon,
                  )}
                />
              </SelectableListItem>
            ))}
        </SelectableList>
      </DropdownMenuItemsContainer>
    </DropdownContent>
  );
};
