import { ChartAggregateOperationSelectionDropdownContent } from '@/side-panel/pages/page-layout/components/dropdown-content/ChartAggregateOperationSelectionDropdownContent';
import { ChartGroupByFieldSelectionRawJsonFieldView } from '@/side-panel/pages/page-layout/components/dropdown-content/ChartGroupByFieldSelectionRawJsonFieldView';
import { usePageLayoutIdFromContextStore } from '@/side-panel/pages/page-layout/hooks/usePageLayoutIdFromContextStore';
import { useWidgetInEditMode } from '@/side-panel/pages/page-layout/hooks/useWidgetInEditMode';
import { isWidgetConfigurationOfType } from '@/side-panel/pages/page-layout/utils/isWidgetConfigurationOfType';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { isHiddenSystemField } from '@/object-metadata/utils/isHiddenSystemField';
import { isFieldRelation } from '@/object-record/record-field/ui/types/guards/isFieldRelation';
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
import { useState } from 'react';
import { useIcons } from 'twenty-ui/icon';
import { MenuItemSelect } from 'twenty-ui/navigation';
import { filterBySearchQuery } from '~/utils/filterBySearchQuery';
import { FieldMetadataType } from '~/generated-metadata/graphql';

export const ChartFieldSelectionForAggregateOperationDropdownContent = () => {
  const [isSubMenuOpen, setIsSubMenuOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const { objectMetadataItems } = useObjectMetadataItems();
  const { pageLayoutId } = usePageLayoutIdFromContextStore();
  const { widgetInEditMode } = useWidgetInEditMode(pageLayoutId);

  const configuration = widgetInEditMode?.configuration;

  const isBarOrLineChart =
    isWidgetConfigurationOfType(configuration, 'BarChartConfiguration') ||
    isWidgetConfigurationOfType(configuration, 'LineChartConfiguration');
  const isAggregateChart = isWidgetConfigurationOfType(
    configuration,
    'AggregateChartConfiguration',
  );
  const isPieChart = isWidgetConfigurationOfType(
    configuration,
    'PieChartConfiguration',
  );

  if (!isBarOrLineChart && !isAggregateChart && !isPieChart) {
    throw new Error('Invalid configuration type');
  }

  const currentFieldMetadataId = configuration.aggregateFieldMetadataId;

  const [selectedFieldMetadataId, setSelectedFieldMetadataId] = useState(
    currentFieldMetadataId,
  );

  const [selectedAggregateSubFieldName, setSelectedAggregateSubFieldName] =
    useState<string | undefined>(
      'aggregateSubFieldName' in configuration
        ? configuration.aggregateSubFieldName ?? undefined
        : undefined,
    );

  const [selectedRawJsonField, setSelectedRawJsonField] =
    useState<FieldMetadataItem | null>(null);

  const sourceObjectMetadataItem = objectMetadataItems.find(
    (item) => item.id === widgetInEditMode?.objectMetadataId,
  );

  const dropdownId = useAvailableComponentInstanceIdOrThrow(
    DropdownComponentInstanceContext,
  );

  const selectedItemId = useAtomComponentStateValue(
    selectedItemIdComponentState,
    dropdownId,
  );

  const availableFieldMetadataItems = filterBySearchQuery({
    items: sourceObjectMetadataItem?.fields || [],
    searchQuery,
    getSearchableValues: (item) => [item.label, item.name],
    // TODO: remove the relation filter once group by is supported for relation fields
  }).filter((field) => !isFieldRelation(field) && !isHiddenSystemField(field));

  const { getIcon } = useIcons();

  if (isSubMenuOpen) {
    return (
      <ChartAggregateOperationSelectionDropdownContent
        currentFieldMetadataId={selectedFieldMetadataId}
        currentAggregateSubFieldName={selectedAggregateSubFieldName}
        setIsSubMenuOpen={setIsSubMenuOpen}
      />
    );
  }

  if (selectedRawJsonField) {
    return (
      <ChartGroupByFieldSelectionRawJsonFieldView
        rawJsonField={selectedRawJsonField}
        currentSubFieldName={selectedAggregateSubFieldName}
        onBack={() => {
          setSelectedRawJsonField(null);
        }}
        onSelectSubField={(subFieldName) => {
          setSelectedAggregateSubFieldName(subFieldName);
          setSelectedFieldMetadataId(selectedRawJsonField.id);
          setIsSubMenuOpen(true);
        }}
      />
    );
  }

  return (
    <>
      <DropdownMenuSearchInput
        autoFocus
        type="text"
        placeholder={t`Search fields`}
        onChange={(event) => setSearchQuery(event.target.value)}
        value={searchQuery}
      />
      <DropdownMenuSeparator />
      <DropdownMenuItemsContainer>
        <SelectableList
          selectableListInstanceId={dropdownId}
          focusId={dropdownId}
          selectableItemIdArray={availableFieldMetadataItems.map(
            (item) => item.id,
          )}
        >
          {availableFieldMetadataItems.map((fieldMetadataItem) => (
            <SelectableListItem
              key={fieldMetadataItem.id}
              itemId={fieldMetadataItem.id}
              onEnter={() => {
                if (fieldMetadataItem.type === FieldMetadataType.RAW_JSON) {
                  setSelectedRawJsonField(fieldMetadataItem);
                  return;
                }

                setSelectedAggregateSubFieldName(undefined);
                setIsSubMenuOpen(true);
                setSelectedFieldMetadataId(fieldMetadataItem.id);
              }}
            >
              <MenuItemSelect
                text={fieldMetadataItem.label}
                selected={selectedFieldMetadataId === fieldMetadataItem.id}
                focused={selectedItemId === fieldMetadataItem.id}
                LeftIcon={getIcon(fieldMetadataItem.icon)}
                hasSubMenu={true}
                onClick={() => {
                  if (fieldMetadataItem.type === FieldMetadataType.RAW_JSON) {
                    setSelectedRawJsonField(fieldMetadataItem);
                    return;
                  }

                  setSelectedAggregateSubFieldName(undefined);
                  setIsSubMenuOpen(true);
                  setSelectedFieldMetadataId(fieldMetadataItem.id);
                }}
              />
            </SelectableListItem>
          ))}
        </SelectableList>
      </DropdownMenuItemsContainer>
    </>
  );
};
