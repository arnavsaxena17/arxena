import { useCallback } from 'react';

import { useUpsertObjectFilterDropdownCurrentFilter } from '@/object-record/object-filter-dropdown/hooks/useUpsertObjectFilterDropdownCurrentFilter';
import { fieldMetadataItemUsedInDropdownComponentSelector } from '@/object-record/object-filter-dropdown/states/fieldMetadataItemUsedInDropdownComponentSelector';
import { objectFilterDropdownCurrentRecordFilterComponentState } from '@/object-record/object-filter-dropdown/states/objectFilterDropdownCurrentRecordFilterComponentState';
import { ObjectFilterDropdownComponentInstanceContext } from '@/object-record/object-filter-dropdown/states/contexts/ObjectFilterDropdownComponentInstanceContext';
import { useCreateRecordFilterFromObjectFilterDropdownCurrentStates } from '@/object-record/record-filter/hooks/useCreateRecordFilterFromObjectFilterDropdownCurrentStates';
import { RecordFilter } from '@/object-record/record-filter/types/RecordFilter';
import { useAvailableComponentInstanceIdOrThrow } from '@/ui/utilities/state/component-state/hooks/useAvailableComponentInstanceIdOrThrow';
import { useRecoilComponentCallbackStateV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentCallbackStateV2';
import { getSnapshotValue } from '@/ui/utilities/state/utils/getSnapshotValue';
import { useRecoilCallback } from 'recoil';
import { isDefined } from 'twenty-shared';

export const useApplyObjectFilterDropdownFilterValue = () => {
  const instanceId = useAvailableComponentInstanceIdOrThrow(
    ObjectFilterDropdownComponentInstanceContext,
  );

  const objectFilterDropdownCurrentRecordFilterCallbackState =
    useRecoilComponentCallbackStateV2(
      objectFilterDropdownCurrentRecordFilterComponentState,
    );

  const fieldMetadataItemUsedInDropdownCallbackState =
    useRecoilComponentCallbackStateV2(
      fieldMetadataItemUsedInDropdownComponentSelector,
    );

  const { createRecordFilterFromObjectFilterDropdownCurrentStates } =
    useCreateRecordFilterFromObjectFilterDropdownCurrentStates();

  const { upsertObjectFilterDropdownCurrentFilter } =
    useUpsertObjectFilterDropdownCurrentFilter();

  const applyObjectFilterDropdownFilterValue = useRecoilCallback(
    ({ snapshot }) =>
      (newFilterValue: string, newDisplayValue?: string) => {
        const existingObjectFilterDropdownCurrentRecordFilter = getSnapshotValue(
          snapshot,
          objectFilterDropdownCurrentRecordFilterCallbackState,
        );

        const currentFieldMetadataItemUsedInDropdown = getSnapshotValue(
          snapshot,
          fieldMetadataItemUsedInDropdownCallbackState,
        );

        const objectFilterDropdownFilterNotYetCreated = !isDefined(
          existingObjectFilterDropdownCurrentRecordFilter,
        );

        if (objectFilterDropdownFilterNotYetCreated) {
          if (!isDefined(currentFieldMetadataItemUsedInDropdown)) {
            throw new Error(
              'Field metadata item is not defined in object filter dropdown when setting a filter value to create it.',
            );
          }

          const { newRecordFilterFromObjectFilterDropdownStates } =
            createRecordFilterFromObjectFilterDropdownCurrentStates();

          const newCurrentRecordFilter = {
            ...newRecordFilterFromObjectFilterDropdownStates,
            value: newFilterValue,
            displayValue: newDisplayValue ?? newFilterValue,
          } satisfies RecordFilter;

          upsertObjectFilterDropdownCurrentFilter(newCurrentRecordFilter);
        } else {
          const newCurrentRecordFilter = {
            ...existingObjectFilterDropdownCurrentRecordFilter,
            value: newFilterValue,
            displayValue: newDisplayValue ?? newFilterValue,
          } satisfies RecordFilter;

          upsertObjectFilterDropdownCurrentFilter(newCurrentRecordFilter);
        }
      },
    [
      objectFilterDropdownCurrentRecordFilterCallbackState,
      fieldMetadataItemUsedInDropdownCallbackState,
      createRecordFilterFromObjectFilterDropdownCurrentStates,
      upsertObjectFilterDropdownCurrentFilter,
    ],
  );

  return {
    applyObjectFilterDropdownFilterValue,
  };
};
