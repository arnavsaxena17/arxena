import { AdvancedFilterContext } from '@/object-record/advanced-filter/states/context/AdvancedFilterContext';
import { currentRecordFilterGroupsComponentState } from '@/object-record/record-filter-group/states/currentRecordFilterGroupsComponentState';
import { useRecoilComponentCallbackStateV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentCallbackStateV2';
import { getSnapshotValue } from '@/ui/utilities/state/utils/getSnapshotValue';
import { useContext } from 'react';
import { useRecoilCallback } from 'recoil';

export const useRemoveRecordFilterGroup = () => {
  const currentRecordFilterGroupsCallbackState =
    useRecoilComponentCallbackStateV2(currentRecordFilterGroupsComponentState);
  const { onUpdate } = useContext(AdvancedFilterContext);

  const removeRecordFilterGroupCallback = useRecoilCallback(
    ({ set, snapshot }) =>
      (recordFilterGroupIdToRemove: string) => {
        const existingRecordFilterGroups = getSnapshotValue(
          snapshot,
          currentRecordFilterGroupsCallbackState,
        );

        const hasFoundRecordFilterGroupInCurrentRecordFilterGroups =
          existingRecordFilterGroups.some(
            (existingRecordFilterGroup) =>
              existingRecordFilterGroup.id === recordFilterGroupIdToRemove,
          );

        if (!hasFoundRecordFilterGroupInCurrentRecordFilterGroups) {
          return;
        }

        set(
          currentRecordFilterGroupsCallbackState,
          (previousRecordFilterGroups) => {
            const newCurrentRecordFilterGroups = [...previousRecordFilterGroups];

            const indexOfRecordFilterGroupToRemove =
              newCurrentRecordFilterGroups.findIndex(
                (existingRecordFilterGroup) =>
                  existingRecordFilterGroup.id === recordFilterGroupIdToRemove,
              );

            if (indexOfRecordFilterGroupToRemove === -1) {
              return newCurrentRecordFilterGroups;
            }

            newCurrentRecordFilterGroups.splice(
              indexOfRecordFilterGroupToRemove,
              1,
            );

            return newCurrentRecordFilterGroups;
          },
        );
      },
    [currentRecordFilterGroupsCallbackState],
  );

  const removeRecordFilterGroup = (recordFilterGroupIdToRemove: string) => {
    removeRecordFilterGroupCallback(recordFilterGroupIdToRemove);
    onUpdate?.();
  };

  return {
    removeRecordFilterGroup,
  };
};
