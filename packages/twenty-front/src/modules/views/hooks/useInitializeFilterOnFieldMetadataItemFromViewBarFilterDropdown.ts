import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { useGetInitialFilterValue } from '@/object-record/object-filter-dropdown/hooks/useGetInitialFilterValue';
import { useUpsertObjectFilterDropdownCurrentFilter } from '@/object-record/object-filter-dropdown/hooks/useUpsertObjectFilterDropdownCurrentFilter';
import { fieldMetadataItemIdUsedInDropdownComponentState } from '@/object-record/object-filter-dropdown/states/fieldMetadataItemIdUsedInDropdownComponentState';
import { objectFilterDropdownCurrentRecordFilterComponentState } from '@/object-record/object-filter-dropdown/states/objectFilterDropdownCurrentRecordFilterComponentState';
import { objectFilterDropdownFilterIsSelectedComponentState } from '@/object-record/object-filter-dropdown/states/objectFilterDropdownFilterIsSelectedComponentState';
import { objectFilterDropdownSearchInputComponentState } from '@/object-record/object-filter-dropdown/states/objectFilterDropdownSearchInputComponentState';
import { selectedOperandInDropdownComponentState } from '@/object-record/object-filter-dropdown/states/selectedOperandInDropdownComponentState';
import { subFieldNameUsedInDropdownComponentState } from '@/object-record/object-filter-dropdown/states/subFieldNameUsedInDropdownComponentState';
import { currentRecordFiltersComponentState } from '@/object-record/record-filter/states/currentRecordFiltersComponentState';
import { type RecordFilter } from '@/object-record/record-filter/types/RecordFilter';
import { findDuplicateRecordFilterInNonAdvancedRecordFilters } from '@/object-record/record-filter/utils/findDuplicateRecordFilterInNonAdvancedRecordFilters';

import { getRecordFilterOperands } from '@/object-record/record-filter/utils/getRecordFilterOperands';
import { usePushFocusItemToFocusStack } from '@/ui/utilities/focus/hooks/usePushFocusItemToFocusStack';
import { FocusComponentType } from '@/ui/utilities/focus/types/FocusComponentType';
import { useAtomComponentStateCallbackState } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateCallbackState';
import { ViewBarFilterDropdownIds } from '@/views/constants/ViewBarFilterDropdownIds';

import { useStore } from 'jotai';
import { useCallback } from 'react';
import {
  getFilterTypeFromFieldType,
  getKnownRawJsonPathKeysForField,
  isDefined,
} from 'twenty-shared/utils';
import { FieldMetadataType } from '~/generated-metadata/graphql';
import { v4 } from 'uuid';

export const useInitializeFilterOnFieldMetadataItemFromViewBarFilterDropdown =
  () => {
    const selectedOperandInDropdownCallbackState =
      useAtomComponentStateCallbackState(
        selectedOperandInDropdownComponentState,
      );

    const currentRecordFiltersCallbackState =
      useAtomComponentStateCallbackState(currentRecordFiltersComponentState);

    const objectFilterDropdownCurrentRecordFilterCallbackState =
      useAtomComponentStateCallbackState(
        objectFilterDropdownCurrentRecordFilterComponentState,
      );

    const fieldMetadataItemUsedInDropdownCallbackState =
      useAtomComponentStateCallbackState(
        fieldMetadataItemIdUsedInDropdownComponentState,
      );

    const objectFilterDropdownFilterIsSelectedCallbackState =
      useAtomComponentStateCallbackState(
        objectFilterDropdownFilterIsSelectedComponentState,
      );

    const objectFilterDropdownSearchInputCallbackState =
      useAtomComponentStateCallbackState(
        objectFilterDropdownSearchInputComponentState,
      );

    const subFieldNameUsedInDropdownCallbackState =
      useAtomComponentStateCallbackState(
        subFieldNameUsedInDropdownComponentState,
      );

    const { upsertObjectFilterDropdownCurrentFilter } =
      useUpsertObjectFilterDropdownCurrentFilter();

    const { pushFocusItemToFocusStack } = usePushFocusItemToFocusStack();
    const { getInitialFilterValue } = useGetInitialFilterValue();

    const store = useStore();

    const initializeFilterOnFieldMetataItemFromViewBarFilterDropdown =
      useCallback(
        (fieldMetadataItem: FieldMetadataItem) => {
          store.set(
            fieldMetadataItemUsedInDropdownCallbackState,
            fieldMetadataItem.id,
          );

          const currentRecordFilters = store.get(
            currentRecordFiltersCallbackState,
          );

          const filterType = getFilterTypeFromFieldType(fieldMetadataItem.type);

          const defaultSubFieldName =
            fieldMetadataItem.type === FieldMetadataType.RAW_JSON
              ? (getKnownRawJsonPathKeysForField(fieldMetadataItem.name)?.[0] ??
                null)
              : null;

          if (filterType === 'RELATION' || filterType === 'SELECT') {
            pushFocusItemToFocusStack({
              focusId: ViewBarFilterDropdownIds.MAIN,
              component: {
                type: FocusComponentType.DROPDOWN,
                instanceId: fieldMetadataItem.id,
              },
              globalHotkeysConfig: {
                enableGlobalHotkeysConflictingWithKeyboard: false,
              },
            });
          }

          store.set(objectFilterDropdownFilterIsSelectedCallbackState, true);

          store.set(objectFilterDropdownSearchInputCallbackState, '');

          store.set(
            subFieldNameUsedInDropdownCallbackState,
            defaultSubFieldName,
          );

          const defaultOperand = getRecordFilterOperands({
            filterType,
            subFieldName: defaultSubFieldName,
          })[0];

          const duplicateFilterInCurrentRecordFilters =
            findDuplicateRecordFilterInNonAdvancedRecordFilters({
              recordFilters: currentRecordFilters,
              fieldMetadataItemId: fieldMetadataItem.id,
              subFieldName: defaultSubFieldName,
            });

          const filterIsAlreadyInCurrentRecordFilters = isDefined(
            duplicateFilterInCurrentRecordFilters,
          );

          if (filterIsAlreadyInCurrentRecordFilters) {
            store.set(
              objectFilterDropdownCurrentRecordFilterCallbackState,
              duplicateFilterInCurrentRecordFilters,
            );

            store.set(
              selectedOperandInDropdownCallbackState,
              duplicateFilterInCurrentRecordFilters.operand,
            );

            store.set(
              subFieldNameUsedInDropdownCallbackState,
              duplicateFilterInCurrentRecordFilters.subFieldName ?? null,
            );
          } else {
            store.set(selectedOperandInDropdownCallbackState, defaultOperand);

            if (
              filterType === 'DATE' ||
              filterType === 'DATE_TIME' ||
              filterType === 'RAW_JSON'
            ) {
              const { displayValue, value } = getInitialFilterValue(
                filterType,
                defaultOperand,
              );

              const initialRecordFilter: RecordFilter = {
                id: v4(),
                fieldMetadataId: fieldMetadataItem.id,
                operand: defaultOperand,
                displayValue,
                label: fieldMetadataItem.label,
                type: filterType,
                value,
                subFieldName: defaultSubFieldName,
              };

              upsertObjectFilterDropdownCurrentFilter(initialRecordFilter);

              store.set(
                objectFilterDropdownCurrentRecordFilterCallbackState,
                initialRecordFilter,
              );
            }
          }
        },
        [
          store,
          fieldMetadataItemUsedInDropdownCallbackState,
          currentRecordFiltersCallbackState,
          objectFilterDropdownFilterIsSelectedCallbackState,
          objectFilterDropdownSearchInputCallbackState,
          subFieldNameUsedInDropdownCallbackState,
          pushFocusItemToFocusStack,
          objectFilterDropdownCurrentRecordFilterCallbackState,
          selectedOperandInDropdownCallbackState,
          upsertObjectFilterDropdownCurrentFilter,
          getInitialFilterValue,
        ],
      );

    return {
      initializeFilterOnFieldMetataItemFromViewBarFilterDropdown,
    };
  };
