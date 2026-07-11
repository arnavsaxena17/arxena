import { AdvancedFilterContext } from '@/object-record/advanced-filter/states/context/AdvancedFilterContext';
import { currentRecordFilterGroupsComponentState } from '@/object-record/record-filter-group/states/currentRecordFilterGroupsComponentState';
import { RecordFilterGroup } from '@/object-record/record-filter-group/types/RecordFilterGroup';
import { useRecoilComponentCallbackStateV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentCallbackStateV2';
import { getSnapshotValue } from '@/ui/utilities/state/utils/getSnapshotValue';
import { useContext } from 'react';
import { useRecoilCallback } from 'recoil';

export const useUpsertRecordFilterGroup = () => {
  const currentRecordFilterGroupsCallbackState =
    useRecoilComponentCallbackStateV2(currentRecordFilterGroupsComponentState);
  const { onUpdate } = useContext(AdvancedFilterContext);

  const upsertRecordFilterGroupCallback = useRecoilCallback(
    ({ set, snapshot }) =>
      (recordFilterGroupToSet: RecordFilterGroup) => {
        const existingRecordFilterGroups = getSnapshotValue(
          snapshot,
          currentRecordFilterGroupsCallbackState,
        );

        const hasFoundRecordFilterGroupInCurrentRecordFilterGroups =
          existingRecordFilterGroups.some(
            (existingRecordFilterGroup) =>
              existingRecordFilterGroup.id === recordFilterGroupToSet.id,
          );

        if (!hasFoundRecordFilterGroupInCurrentRecordFilterGroups) {
          set(currentRecordFilterGroupsCallbackState, [
            ...existingRecordFilterGroups,
            recordFilterGroupToSet,
          ]);
        } else {
          set(
            currentRecordFilterGroupsCallbackState,
            (previousRecordFilterGroups) => {
              const newCurrentRecordFilterGroups = [
                ...previousRecordFilterGroups,
              ];

              const indexOfRecordFilterGroupToUpdate =
                newCurrentRecordFilterGroups.findIndex(
                  (existingRecordFilterGroup) =>
                    existingRecordFilterGroup.id === recordFilterGroupToSet.id,
                );

              if (indexOfRecordFilterGroupToUpdate === -1) {
                return newCurrentRecordFilterGroups;
              }

              newCurrentRecordFilterGroups[indexOfRecordFilterGroupToUpdate] = {
                ...recordFilterGroupToSet,
              };

              return newCurrentRecordFilterGroups;
            },
          );
        }
      },
    [currentRecordFilterGroupsCallbackState],
  );

  const upsertRecordFilterGroup = (
    recordFilterGroupToSet: RecordFilterGroup,
  ) => {
    upsertRecordFilterGroupCallback(recordFilterGroupToSet);
    queueMicrotask(() => {
      onUpdate?.();
    });
  };

  return {
    upsertRecordFilterGroup,
  };
};
