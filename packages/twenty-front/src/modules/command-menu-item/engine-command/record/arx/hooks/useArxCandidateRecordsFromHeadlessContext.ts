import { useHeadlessCommandContextApi } from '@/command-menu-item/engine-command/hooks/useHeadlessCommandContextApi';
import {
  getUniqueRecordIdsFromRecords,
  getSelectedRecordIdsFromHeadlessContext,
} from '@/command-menu-item/engine-command/record/arx/utils/getSelectedRecordIdsFromHeadlessContext';
import { isProjectRoute } from '@/command-menu-item/engine-command/record/arx/utils/isProjectRoute';
import { searchResultsState } from '@/candidate-search/states/searchResultsState';
import { tableStateAtom } from '@/candidate-table/states/states';
import { DEFAULT_QUERY_PAGE_SIZE } from '@/object-record/constants/DefaultQueryPageSize';
import { useLazyFetchAllRecords } from '@/object-record/hooks/useLazyFetchAllRecords';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { type RecordGqlOperationFilter } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

type UseArxCandidateRecordsFromHeadlessContextParams = {
  recordGqlFields?: Record<string, boolean | Record<string, boolean>>;
};

const noMatchFilter: RecordGqlOperationFilter = { id: { in: [] } };

export const useArxCandidateRecordsFromHeadlessContext = ({
  recordGqlFields,
}: UseArxCandidateRecordsFromHeadlessContextParams = {}) => {
  const location = useLocation();
  const onProjectRoute = isProjectRoute(location.pathname);
  const tableState = useAtomStateValue(tableStateAtom);
  const searchResults = useAtomStateValue(searchResultsState);

  const { objectMetadataItem, selectedRecords, graphqlFilter } =
    useHeadlessCommandContextApi();

  const { fetchAllRecords } = useLazyFetchAllRecords({
    objectNameSingular: objectMetadataItem?.nameSingular ?? 'candidate',
    filter: graphqlFilter ?? noMatchFilter,
    limit: DEFAULT_QUERY_PAGE_SIZE,
    recordGqlFields,
  });

  const resolveRecords = useCallback(async (): Promise<ObjectRecord[]> => {
    if (
      onProjectRoute &&
      isDefined(tableState?.selectedRowIds) &&
      tableState.selectedRowIds.length > 0
    ) {
      const selectedIdsSet = new Set(tableState.selectedRowIds);

      const databaseCandidates = tableState.rawData.filter((record) =>
        selectedIdsSet.has(record.id),
      );

      const searchCandidates = searchResults.filter((record) => {
        const recordId = record?.id;
        const recordTempId = record?.tempId;

        return (
          (isDefined(recordId) && selectedIdsSet.has(recordId)) ||
          (isDefined(recordTempId) && selectedIdsSet.has(recordTempId))
        );
      });

      return [...databaseCandidates, ...searchCandidates] as unknown as ObjectRecord[];
    }

    if (selectedRecords.length > 0) {
      return selectedRecords;
    }

    return fetchAllRecords();
  }, [
    fetchAllRecords,
    onProjectRoute,
    searchResults,
    selectedRecords,
    tableState,
  ]);

  const resolveRecordIds = useCallback(async (): Promise<string[]> => {
    const records = await resolveRecords();

    return getUniqueRecordIdsFromRecords(records);
  }, [resolveRecords]);

  const selectedRecordCount =
    onProjectRoute && isDefined(tableState?.selectedRowIds)
      ? tableState.selectedRowIds.length
      : selectedRecords.length > 0
        ? getSelectedRecordIdsFromHeadlessContext(selectedRecords).length
        : 0;

  return {
    objectMetadataItem,
    graphqlFilter,
    onProjectRoute,
    selectedRecordCount,
    resolveRecords,
    resolveRecordIds,
  };
};
