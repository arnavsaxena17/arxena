import { AdvancedFilterContext } from '@/object-record/advanced-filter/states/context/AdvancedFilterContext';
import { currentRecordFiltersComponentState } from '@/object-record/record-filter/states/currentRecordFiltersComponentState';
import { useRecoilComponentCallbackStateV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentCallbackStateV2';
import { getSnapshotValue } from '@/ui/utilities/state/utils/getSnapshotValue';
import { useContext } from 'react';
import { useRecoilCallback } from 'recoil';
import { isDefined } from 'twenty-shared';

export const useRemoveRecordFilter = () => {
  const currentRecordFiltersCallbackState = useRecoilComponentCallbackStateV2(
    currentRecordFiltersComponentState,
  );
  const { onUpdate } = useContext(AdvancedFilterContext);

  const removeRecordFilterCallback = useRecoilCallback(
    ({ set, snapshot }) =>
      ({ recordFilterId }: { recordFilterId: string }) => {
        const currentRecordFilters = getSnapshotValue(
          snapshot,
          currentRecordFiltersCallbackState,
        );

        const filterToRemove = currentRecordFilters.find(
          (existingFilter) => existingFilter.id === recordFilterId,
        );

        if (!isDefined(filterToRemove)) {
          return;
        }

        set(currentRecordFiltersCallbackState, (previousRecordFilters) => {
          const newCurrentRecordFilters = [...previousRecordFilters];

          const indexOfFilterToRemove = newCurrentRecordFilters.findIndex(
            (existingFilter) => existingFilter.id === recordFilterId,
          );

          newCurrentRecordFilters.splice(indexOfFilterToRemove, 1);

          return newCurrentRecordFilters;
        });
      },
    [currentRecordFiltersCallbackState],
  );

  const removeRecordFilter = ({
    recordFilterId,
  }: {
    recordFilterId: string;
  }) => {
    removeRecordFilterCallback({ recordFilterId });
    onUpdate?.();
  };

  const removeRecordFilterByFieldMetadataId = useRecoilCallback(
    ({ set, snapshot }) =>
      (fieldMetadataId: string) => {
        const currentRecordFilters = getSnapshotValue(
          snapshot,
          currentRecordFiltersCallbackState,
        );

        const foundRecordFilterInCurrentRecordFilters =
          currentRecordFilters.some(
            (existingFilter) =>
              existingFilter.fieldMetadataId === fieldMetadataId,
          );

        if (!foundRecordFilterInCurrentRecordFilters) {
          return;
        }

        set(currentRecordFiltersCallbackState, (filters) => {
          const newCurrentRecordFilters = [...filters];

          const indexOfFilterToRemove = newCurrentRecordFilters.findIndex(
            (existingFilter) =>
              existingFilter.fieldMetadataId === fieldMetadataId,
          );

          newCurrentRecordFilters.splice(indexOfFilterToRemove, 1);

          return newCurrentRecordFilters;
        });
      },
    [currentRecordFiltersCallbackState],
  );

  return {
    removeRecordFilter,
    removeRecordFilterByFieldMetadataId,
  };
};
