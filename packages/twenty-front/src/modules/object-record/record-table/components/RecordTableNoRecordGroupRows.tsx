import { recordIndexAllRecordIdsComponentSelector } from '@/object-record/record-index/states/selectors/recordIndexAllRecordIdsComponentSelector';
import { RecordTableBodyFetchMoreLoader } from '@/object-record/record-table/record-table-body/components/RecordTableBodyFetchMoreLoader';
import { RecordTableAggregateFooter } from '@/object-record/record-table/record-table-footer/components/RecordTableAggregateFooter';
import { RecordTableRow } from '@/object-record/record-table/record-table-row/components/RecordTableRow';
import { isRecordTableInitialLoadingComponentState } from '@/object-record/record-table/states/isRecordTableInitialLoadingComponentState';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';

export const RecordTableNoRecordGroupRows = () => {
  const allRecordIds = useRecoilComponentValueV2(
    recordIndexAllRecordIdsComponentSelector,
  );

  console.log('RecordTableNoRecordGroupRows rendering', allRecordIds);
  console.log(
    'RecordTableNoRecordGroupRows recordIndexAllRecordIdsComponentSelector',
    recordIndexAllRecordIdsComponentSelector,
  );
  const isRecordTableInitialLoading = useRecoilComponentValueV2(
    isRecordTableInitialLoadingComponentState,
  );
  console.log(
    'RecordTableNoRecordGroupRows isRecordTableInitialLoading',
    isRecordTableInitialLoading,
  );
  console.log(
    'RecordTableNoRecordGroupRows isRecordTableInitialLoadingComponentState',
    isRecordTableInitialLoadingComponentState,
  );

  return (
    <>
      {allRecordIds.map((recordId, rowIndex) => {
        return (
          <RecordTableRow
            key={recordId}
            recordId={recordId}
            rowIndexForFocus={rowIndex}
            rowIndexForDrag={rowIndex}
          />
        );
      })}
      <RecordTableBodyFetchMoreLoader />
      {!isRecordTableInitialLoading && allRecordIds.length > 0 && (
        <RecordTableAggregateFooter />
      )}
    </>
  );
};
