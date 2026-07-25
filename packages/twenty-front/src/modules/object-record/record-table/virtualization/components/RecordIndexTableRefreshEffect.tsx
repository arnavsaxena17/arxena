import { useEffect, useRef } from 'react';

import { recordIndexTableRefreshFunctionState } from '@/object-record/record-index/states/recordIndexTableRefreshFunctionState';
import { useRecordTableContextOrThrow } from '@/object-record/record-table/contexts/RecordTableContext';
import { useResetVirtualizationBecauseDataChanged } from '@/object-record/record-table/virtualization/hooks/useResetVirtualizationBecauseDataChanged';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';

// Registers the table-scoped reload so ViewBar refresh reloads rows, not every FindMany*
export const RecordIndexTableRefreshEffect = () => {
  const { objectNameSingular } = useRecordTableContextOrThrow();
  const { resetVirtualizationBecauseDataChanged } =
    useResetVirtualizationBecauseDataChanged(objectNameSingular);
  const setRecordIndexTableRefreshFunction = useSetAtomState(
    recordIndexTableRefreshFunctionState,
  );

  const refreshRef = useRef(resetVirtualizationBecauseDataChanged);
  refreshRef.current = resetVirtualizationBecauseDataChanged;

  useEffect(() => {
    setRecordIndexTableRefreshFunction(() => () => refreshRef.current());

    return () => {
      setRecordIndexTableRefreshFunction(null);
    };
  }, [setRecordIndexTableRefreshFunction]);

  return null;
};
