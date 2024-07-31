import { Key } from 'ts-key-enum';

import { SOFT_FOCUS_CLICK_OUTSIDE_LISTENER_ID } from '@/object-record/job-table/constants/SoftFocusClickOutsideListenerId';
import { useRecordTable } from '@/object-record/job-table/hooks/useRecordTable';
import { TableHotkeyScope } from '@/object-record/job-table/types/TableHotkeyScope';
import { useScopedHotkeys } from '@/ui/utilities/hotkey/hooks/useScopedHotkeys';
import { useClickOutsideListener } from '@/ui/utilities/pointer-event/hooks/useClickOutsideListener';
import { useListenClickOutsideByClassName } from '@/ui/utilities/pointer-event/hooks/useListenClickOutside';

type RecordTableInternalEffectProps = {
  recordTableId: string;
  tableBodyRef: React.RefObject<HTMLDivElement>;
};

export const RecordTableInternalEffect = ({ recordTableId, tableBodyRef }: RecordTableInternalEffectProps) => {
  const { leaveTableFocus, resetTableRowSelection, useMapKeyboardToSoftFocus } = useRecordTable({ recordTableId });

  useMapKeyboardToSoftFocus();

  const { useListenClickOutside } = useClickOutsideListener(SOFT_FOCUS_CLICK_OUTSIDE_LISTENER_ID);

  useListenClickOutside({
    refs: [tableBodyRef],
    callback: () => {
      leaveTableFocus();
    },
  });

  useScopedHotkeys(
    [Key.Escape],
    () => {
      resetTableRowSelection();
    },
    TableHotkeyScope.Table,
  );

  useListenClickOutsideByClassName({
    classNames: ['entity-table-cell'],
    excludeClassNames: ['action-bar', 'context-menu'],
    callback: () => {
      resetTableRowSelection();
    },
  });

  return <></>;
};
