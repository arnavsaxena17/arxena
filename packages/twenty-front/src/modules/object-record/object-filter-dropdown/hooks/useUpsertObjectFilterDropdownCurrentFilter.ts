import { objectFilterDropdownCurrentRecordFilterComponentState } from '@/object-record/object-filter-dropdown/states/objectFilterDropdownCurrentRecordFilterComponentState';
import { useUpsertRecordFilter } from '@/object-record/record-filter/hooks/useUpsertRecordFilter';
import { RecordFilter } from '@/object-record/record-filter/types/RecordFilter';
import { useAvailableComponentInstanceIdOrThrow } from '@/ui/utilities/state/component-state/hooks/useAvailableComponentInstanceIdOrThrow';
import { ObjectFilterDropdownComponentInstanceContext } from '@/object-record/object-filter-dropdown/states/contexts/ObjectFilterDropdownComponentInstanceContext';
import { useRecoilCallback } from 'recoil';

export const useUpsertObjectFilterDropdownCurrentFilter = () => {
  const instanceId = useAvailableComponentInstanceIdOrThrow(
    ObjectFilterDropdownComponentInstanceContext,
  );
  const { upsertRecordFilter } = useUpsertRecordFilter();

  const upsertObjectFilterDropdownCurrentFilter = useRecoilCallback(
    ({ set }) =>
      (recordFilterToUpsert: RecordFilter) => {
        upsertRecordFilter(recordFilterToUpsert);

        set(
          objectFilterDropdownCurrentRecordFilterComponentState.atomFamily({
            instanceId,
          }),
          recordFilterToUpsert,
        );
      },
    [instanceId, upsertRecordFilter],
  );

  return {
    upsertObjectFilterDropdownCurrentFilter,
  };
};
