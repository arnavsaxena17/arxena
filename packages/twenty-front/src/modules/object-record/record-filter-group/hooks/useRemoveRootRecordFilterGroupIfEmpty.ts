import { useRemoveRecordFilterGroup } from '@/object-record/record-filter-group/hooks/useRemoveRecordFilterGroup';
import { currentRecordFilterGroupsComponentState } from '@/object-record/record-filter-group/states/currentRecordFilterGroupsComponentState';
import { currentRecordFiltersComponentState } from '@/object-record/record-filter/states/currentRecordFiltersComponentState';
import { useRecoilComponentCallbackStateV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentCallbackStateV2';
import { getSnapshotValue } from '@/ui/utilities/state/utils/getSnapshotValue';
import { useRecoilCallback } from 'recoil';
import { isDefined } from 'twenty-shared';

export const useRemoveRootRecordFilterGroupIfEmpty = () => {
  const currentRecordFilterGroupsCallbackState =
    useRecoilComponentCallbackStateV2(currentRecordFilterGroupsComponentState);
  const currentRecordFiltersCallbackState = useRecoilComponentCallbackStateV2(
    currentRecordFiltersComponentState,
  );
  const { removeRecordFilterGroup } = useRemoveRecordFilterGroup();

  const removeRootRecordFilterGroupIfEmpty = useRecoilCallback(
    ({ snapshot }) =>
      () => {
        const existingRecordFilterGroups = getSnapshotValue(
          snapshot,
          currentRecordFilterGroupsCallbackState,
        );
        const existingRecordFilters = getSnapshotValue(
          snapshot,
          currentRecordFiltersCallbackState,
        );

        const rootRecordFilterGroup = existingRecordFilterGroups.find(
          (existingRecordFilterGroup) =>
            !isDefined(existingRecordFilterGroup.parentRecordFilterGroupId),
        );

        if (!isDefined(rootRecordFilterGroup)) {
          return;
        }

        const recordFilterGroupsInRootRecordFilterGroup =
          existingRecordFilterGroups.filter(
            (recordFilterGroupToFilter) =>
              recordFilterGroupToFilter.parentRecordFilterGroupId ===
              rootRecordFilterGroup.id,
          );

        const recordFiltersInRootRecordFilterGroup = existingRecordFilters.filter(
          (recordFilterToFilter) =>
            recordFilterToFilter.recordFilterGroupId === rootRecordFilterGroup.id,
        );

        const rootRecordFilterGroupIsEmpty =
          recordFilterGroupsInRootRecordFilterGroup.length === 0 &&
          recordFiltersInRootRecordFilterGroup.length === 0;

        if (rootRecordFilterGroupIsEmpty) {
          removeRecordFilterGroup(rootRecordFilterGroup.id);
        }
      },
    [
      currentRecordFilterGroupsCallbackState,
      currentRecordFiltersCallbackState,
      removeRecordFilterGroup,
    ],
  );

  return {
    removeRootRecordFilterGroupIfEmpty,
  };
};
