import { rootLevelRecordFilterGroupComponentSelector } from '@/object-record/advanced-filter/states/rootLevelRecordFilterGroupComponentSelector';
import { getAdvancedFilterObjectFilterDropdownComponentInstanceId } from '@/object-record/advanced-filter/utils/getAdvancedFilterObjectFilterDropdownComponentInstanceId';
import { fieldMetadataItemIdUsedInDropdownComponentState } from '@/object-record/object-filter-dropdown/states/fieldMetadataItemIdUsedInDropdownComponentState';
import { objectFilterDropdownCurrentRecordFilterComponentState } from '@/object-record/object-filter-dropdown/states/objectFilterDropdownCurrentRecordFilterComponentState';
import { subFieldNameUsedInDropdownComponentState } from '@/object-record/object-filter-dropdown/states/subFieldNameUsedInDropdownComponentState';
import { currentRecordFilterGroupsComponentState } from '@/object-record/record-filter-group/states/currentRecordFilterGroupsComponentState';
import { currentRecordFiltersComponentState } from '@/object-record/record-filter/states/currentRecordFiltersComponentState';
import { RecordFilter } from '@/object-record/record-filter/types/RecordFilter';
import { useRecoilComponentCallbackStateV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentCallbackStateV2';
import { getSnapshotValue } from '@/ui/utilities/state/utils/getSnapshotValue';
import { useRecoilCallback } from 'recoil';

export const useSetAdvancedFilterDropdownStates = () => {
  const currentRecordFiltersCallbackState = useRecoilComponentCallbackStateV2(
    currentRecordFiltersComponentState,
  );
  const currentRecordFilterGroupsCallbackState =
    useRecoilComponentCallbackStateV2(currentRecordFilterGroupsComponentState);
  const rootLevelRecordFilterGroupCallbackState =
    useRecoilComponentCallbackStateV2(
      rootLevelRecordFilterGroupComponentSelector,
    );

  const setAdvancedFilterDropdownStates = useRecoilCallback(
    ({ set, snapshot }) =>
      () => {
        const rootLevelRecordFilterGroup = getSnapshotValue(
          snapshot,
          rootLevelRecordFilterGroupCallbackState,
        );
        const currentRecordFilters = getSnapshotValue(
          snapshot,
          currentRecordFiltersCallbackState,
        );
        const currentRecordFilterGroups = getSnapshotValue(
          snapshot,
          currentRecordFilterGroupsCallbackState,
        );

        const rootLevelRecordFilters = currentRecordFilters.filter(
          (recordFilter) =>
            recordFilter.recordFilterGroupId === rootLevelRecordFilterGroup?.id,
        );

        const setAdvancedFilterStatesForRecordFilter = (
          recordFilter: RecordFilter,
        ) => {
          const dropdownInstanceId =
            getAdvancedFilterObjectFilterDropdownComponentInstanceId(
              recordFilter.id,
            );

          set(
            objectFilterDropdownCurrentRecordFilterComponentState.atomFamily({
              instanceId: dropdownInstanceId,
            }),
            recordFilter,
          );

          set(
            fieldMetadataItemIdUsedInDropdownComponentState.atomFamily({
              instanceId: dropdownInstanceId,
            }),
            recordFilter.fieldMetadataId,
          );

          set(
            subFieldNameUsedInDropdownComponentState.atomFamily({
              instanceId: dropdownInstanceId,
            }),
            recordFilter.subFieldName,
          );
        };

        for (const rootLevelRecordFilter of rootLevelRecordFilters) {
          setAdvancedFilterStatesForRecordFilter(rootLevelRecordFilter);
        }

        const childRecordFilterGroups = currentRecordFilterGroups.filter(
          (currentRecordGroupToFilter) =>
            currentRecordGroupToFilter.parentRecordFilterGroupId ===
            rootLevelRecordFilterGroup?.id,
        );

        for (const childRecordFilterGroup of childRecordFilterGroups) {
          const recordFiltersInThisGroup = currentRecordFilters.filter(
            (recordFilter) =>
              recordFilter.recordFilterGroupId === childRecordFilterGroup.id,
          );

          for (const recordFilterInThisGroup of recordFiltersInThisGroup) {
            setAdvancedFilterStatesForRecordFilter(recordFilterInThisGroup);
          }
        }
      },
    [
      currentRecordFiltersCallbackState,
      currentRecordFilterGroupsCallbackState,
      rootLevelRecordFilterGroupCallbackState,
    ],
  );

  return {
    setAdvancedFilterDropdownStates,
  };
};
