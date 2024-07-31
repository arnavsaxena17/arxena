import { useRecoilValue } from 'recoil';

import { RecordTableRow } from '@/object-record/job-table/components/RecordTableRow';
import { useRecordTableStates } from '@/object-record/job-table/hooks/internal/useRecordTableStates';

export const RecordTablePendingRow = () => {
  const { pendingRecordIdState } = useRecordTableStates();
  const pendingRecordId = useRecoilValue(pendingRecordIdState);

  if (!pendingRecordId) return;

  return <RecordTableRow key={pendingRecordId} recordId={pendingRecordId} rowIndex={-1} isPendingRow />;
};
