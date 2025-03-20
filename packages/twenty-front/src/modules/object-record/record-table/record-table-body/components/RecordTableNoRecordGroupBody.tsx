import { recordIndexAllRecordIdsComponentSelector } from '@/object-record/record-index/states/selectors/recordIndexAllRecordIdsComponentSelector';
import { RecordTableNoRecordGroupBodyContextProvider } from '@/object-record/record-table/components/RecordTableNoRecordGroupBodyContextProvider';
import { RecordTableNoRecordGroupRows } from '@/object-record/record-table/components/RecordTableNoRecordGroupRows';
import { RecordTableBodyDragDropContextProvider } from '@/object-record/record-table/record-table-body/components/RecordTableBodyDragDropContextProvider';
import { RecordTableBodyDroppable } from '@/object-record/record-table/record-table-body/components/RecordTableBodyDroppable';
import { RecordTableBodyLoading } from '@/object-record/record-table/record-table-body/components/RecordTableBodyLoading';
import { RecordTablePendingRow } from '@/object-record/record-table/record-table-row/components/RecordTablePendingRow';
import { isRecordTableInitialLoadingComponentState } from '@/object-record/record-table/states/isRecordTableInitialLoadingComponentState';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';

export const RecordTableNoRecordGroupBody = () => {
  const allRecordIds = useRecoilComponentValueV2(
    recordIndexAllRecordIdsComponentSelector,
  );

  // console.log('RecordTableNoRecordGroupBody rendering', allRecordIds);

  const isRecordTableInitialLoading = useRecoilComponentValueV2(
    isRecordTableInitialLoadingComponentState,
  );

  if (isRecordTableInitialLoading && allRecordIds.length === 0) {
    return <RecordTableBodyLoading />;
  }

  // console.log(
  //   'RecordTableNoRecordGroupBody rendering isRecordTableInitialLoading',
  //   isRecordTableInitialLoading,
  // );
  // console.log(
  //   'RecordTableNoRecordGroupBody rendering isRecordTableInitialLoadingComponentState',
  //   isRecordTableInitialLoadingComponentState,
  // );
  return (
    <RecordTableNoRecordGroupBodyContextProvider>
      <RecordTableBodyDragDropContextProvider>
        <RecordTableBodyDroppable>
          <RecordTablePendingRow />
          <RecordTableNoRecordGroupRows />
        </RecordTableBodyDroppable>
      </RecordTableBodyDragDropContextProvider>
    </RecordTableNoRecordGroupBodyContextProvider>
  );
};
