import { currentRecordFilterGroupsComponentState } from '@/object-record/record-filter-group/states/currentRecordFilterGroupsComponentState';
import { type RecordFilterGroup } from '@/object-record/record-filter-group/types/RecordFilterGroup';
import { RecordFilterGroupsComponentInstanceContext } from '@/object-record/record-filter-group/states/context/RecordFilterGroupsComponentInstanceContext';
import { createComponentSelectorV2 } from '@/ui/utilities/state/component-state/utils/createComponentSelectorV2';
import { isDefined } from 'twenty-shared';

export const rootLevelRecordFilterGroupComponentSelector =
  createComponentSelectorV2<RecordFilterGroup | undefined>({
    key: 'rootLevelRecordFilterGroupComponentSelector',
    componentInstanceContext: RecordFilterGroupsComponentInstanceContext,
    get:
      ({ instanceId }) =>
      ({ get }) => {
        const currentRecordFilterGroups = get(
          currentRecordFilterGroupsComponentState.atomFamily({
            instanceId,
          }),
        );

        const rootLevelRecordFilterGroup = currentRecordFilterGroups.find(
          (recordFilterGroup) =>
            !isDefined(recordFilterGroup.parentRecordFilterGroupId),
        );

        return rootLevelRecordFilterGroup;
      },
  });
