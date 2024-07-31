import { useSetSoftFocus } from '@/object-record/job-table/record-table-cell/hooks/useSetSoftFocus';

import { useCurrentTableCellPosition } from './useCurrentCellPosition';

export const useSetSoftFocusOnCurrentTableCell = () => {
  const setSoftFocus = useSetSoftFocus();

  const currentTableCellPosition = useCurrentTableCellPosition();

  return () => {
    setSoftFocus(currentTableCellPosition);
  };
};
