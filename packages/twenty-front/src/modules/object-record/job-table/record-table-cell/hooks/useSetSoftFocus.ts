import { useRecoilCallback } from 'recoil';

import { useRecordTableStates } from '@/object-record/job-table/hooks/internal/useRecordTableStates';
import { useSetSoftFocusPosition } from '@/object-record/job-table/hooks/internal/useSetSoftFocusPosition';
import { TableCellPosition } from '@/object-record/job-table/types/TableCellPosition';
import { useSetHotkeyScope } from '@/ui/utilities/hotkey/hooks/useSetHotkeyScope';

import { TableHotkeyScope } from '../../types/TableHotkeyScope';

export const useSetSoftFocus = (recordTableId?: string) => {
  const setSoftFocusPosition = useSetSoftFocusPosition(recordTableId);

  const { isSoftFocusActiveState } = useRecordTableStates(recordTableId);

  const setHotkeyScope = useSetHotkeyScope();

  return useRecoilCallback(
    ({ set }) =>
      (newPosition: TableCellPosition) => {
        setSoftFocusPosition(newPosition);

        set(isSoftFocusActiveState, true);

        setHotkeyScope(TableHotkeyScope.TableSoftFocus);
      },
    [setSoftFocusPosition, isSoftFocusActiveState, setHotkeyScope],
  );
};
