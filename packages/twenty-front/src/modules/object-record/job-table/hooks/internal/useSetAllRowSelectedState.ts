import { useRecoilCallback } from 'recoil';

import { useRecordTableStates } from '@/object-record/job-table/hooks/internal/useRecordTableStates';

export const useSetHasUserSelectedAllRows = (recordTableId?: string) => {
  const { hasUserSelectedAllRowState: hasUserSelectedAllRowFamilyState } = useRecordTableStates(recordTableId);

  return useRecoilCallback(
    ({ set }) =>
      (selected: boolean) => {
        set(hasUserSelectedAllRowFamilyState, selected);
      },
    [hasUserSelectedAllRowFamilyState],
  );
};
