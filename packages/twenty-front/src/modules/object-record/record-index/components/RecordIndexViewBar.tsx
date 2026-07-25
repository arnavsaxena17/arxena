import { useCallback, useState } from 'react';

import { useRefetchAggregateQueries } from '@/object-record/hooks/useRefetchAggregateQueries';
import { ObjectOptionsDropdown } from '@/object-record/object-options-dropdown/components/ObjectOptionsDropdown';
import { RecordIndexViewBarEffect } from '@/object-record/record-index/components/RecordIndexViewBarEffect';
import { useRecordIndexContextOrThrow } from '@/object-record/record-index/contexts/RecordIndexContext';
import { useHasCurrentViewNonReadableFields } from '@/object-record/record-index/hooks/useHasCurrentViewNonReadableFields';
import { recordIndexTableRefreshFunctionState } from '@/object-record/record-index/states/recordIndexTableRefreshFunctionState';
import { recordIndexViewTypeState } from '@/object-record/record-index/states/recordIndexViewTypeState';
import { SpreadsheetImportProvider } from '@/spreadsheet-import/provider/components/SpreadsheetImportProvider';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { ViewBar } from '@/views/components/ViewBar';
import { ViewType } from '@/views/types/ViewType';

export const RecordIndexViewBar = () => {
  const recordIndexViewType = useAtomStateValue(recordIndexViewTypeState);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { objectNamePlural, recordIndexId, objectMetadataItem } =
    useRecordIndexContextOrThrow();

  const { hasCurrentViewNonReadableFields } =
    useHasCurrentViewNonReadableFields(objectMetadataItem);

  const recordIndexTableRefreshFunction = useAtomStateValue(
    recordIndexTableRefreshFunctionState,
  );
  const { refetchAggregateQueries } = useRefetchAggregateQueries();
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    try {
      if (recordIndexTableRefreshFunction) {
        await recordIndexTableRefreshFunction();
      } else {
        enqueueErrorSnackBar({
          message: 'Refresh is not ready yet. Try again in a moment.',
        });
        return;
      }

      await refetchAggregateQueries({
        objectMetadataNamePlural: objectNamePlural,
      });
      enqueueSuccessSnackBar({ message: 'Refetched records' });
    } catch (error) {
      console.error('Failed to refetch object records:', error);
      enqueueErrorSnackBar({
        message: 'Failed to refresh records. Please try again.',
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [
    enqueueErrorSnackBar,
    enqueueSuccessSnackBar,
    isRefreshing,
    objectNamePlural,
    recordIndexTableRefreshFunction,
    refetchAggregateQueries,
  ]);

  return (
    <SpreadsheetImportProvider>
      <ViewBar
        isReadOnly={hasCurrentViewNonReadableFields}
        viewBarId={recordIndexId}
        showRefetch={recordIndexViewType === ViewType.TABLE}
        isRefreshing={isRefreshing}
        onRefresh={() => {
          void handleRefresh();
        }}
        optionsDropdownButton={
          <ObjectOptionsDropdown
            recordIndexId={recordIndexId}
            objectMetadataItem={objectMetadataItem}
            viewType={recordIndexViewType ?? ViewType.TABLE}
          />
        }
      />
      <RecordIndexViewBarEffect
        objectNamePlural={objectNamePlural}
        viewBarId={recordIndexId}
      />
    </SpreadsheetImportProvider>
  );
};
