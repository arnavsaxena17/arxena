import { useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { useDebouncedCallback } from 'use-debounce';

import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { hasCustomDataSourceState } from '@/custom-layouts/states/hasCustomDataSourceState';
import { lastShowPageRecordIdState } from '@/object-record/record-field/states/lastShowPageRecordId';
import { useLazyLoadRecordIndexTable } from '@/object-record/record-index/hooks/useLazyLoadRecordIndexTable';
import { ROW_HEIGHT } from '@/object-record/record-table/constants/RowHeight';
import { useRecordTableContextOrThrow } from '@/object-record/record-table/contexts/RecordTableContext';
import { hasRecordTableFetchedAllRecordsComponentStateV2 } from '@/object-record/record-table/states/hasRecordTableFetchedAllRecordsComponentStateV2';
import { tableEncounteredUnrecoverableErrorComponentState } from '@/object-record/record-table/states/tableEncounteredUnrecoverableErrorComponentState';
import { tableLastRowVisibleComponentState } from '@/object-record/record-table/states/tableLastRowVisibleComponentState';
import { isFetchingMoreRecordsFamilyState } from '@/object-record/states/isFetchingMoreRecordsFamilyState';
import { useRecoilComponentStateV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentStateV2';
import { useRecoilComponentValueV2 } from '@/ui/utilities/state/component-state/hooks/useRecoilComponentValueV2';
import { useSetRecoilComponentStateV2 } from '@/ui/utilities/state/component-state/hooks/useSetRecoilComponentStateV2';
import { isNonEmptyString, isNull } from '@sniptt/guards';
import { useScrollToPosition } from '~/hooks/useScrollToPosition';

export const RecordTableNoRecordGroupBodyEffect = () => {
  const { objectNameSingular } = useRecordTableContextOrThrow();

  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);
  const hasCustomDataSource = useRecoilValue(hasCustomDataSourceState);

  const [hasInitializedScroll, setHasInitializedScroll] = useState(false);

  const {
    findManyRecords,
    fetchMoreRecords,
    records,
    totalCount,
    setRecordTableData,
    loading,
    queryStateIdentifier,
    hasNextPage,
  } = useLazyLoadRecordIndexTable(objectNameSingular);

  const isFetchingMoreObjects = useRecoilValue(
    isFetchingMoreRecordsFamilyState(queryStateIdentifier),
  );

  const tableLastRowVisible = useRecoilComponentValueV2(
    tableLastRowVisibleComponentState,
  );

  const [encounteredUnrecoverableError, setEncounteredUnrecoverableError] =
    useRecoilComponentStateV2(tableEncounteredUnrecoverableErrorComponentState);

  const setHasRecordTableFetchedAllRecordsComponents =
    useSetRecoilComponentStateV2(
      hasRecordTableFetchedAllRecordsComponentStateV2,
    );

  const [lastShowPageRecordId, setLastShowPageRecordId] = useRecoilState(
    lastShowPageRecordIdState,
  );

  const [hasInitialized, setHasInitialized] = useState(false);

  const { scrollToPosition } = useScrollToPosition();

  useEffect(() => {
    if (isNonEmptyString(lastShowPageRecordId) && !hasInitializedScroll) {
      const isRecordAlreadyFetched = records.some(
        (record) => record.id === lastShowPageRecordId,
      );

      if (isRecordAlreadyFetched) {
        const recordPosition = records.findIndex(
          (record) => record.id === lastShowPageRecordId,
        );

        const positionInPx = recordPosition * ROW_HEIGHT;

        scrollToPosition(positionInPx);

        setHasInitializedScroll(true);
      }
    }
  }, [
    loading,
    lastShowPageRecordId,
    records,
    scrollToPosition,
    hasInitializedScroll,
    setLastShowPageRecordId,
  ]);

  useEffect(() => {
    // Skip setting record table data if we're using a custom data source
    if (!loading && !hasCustomDataSource) {
      if (!window.location.pathname.includes('merged')) {
        setRecordTableData({
          records,
          totalCount,
        });
      } else {
        console.log(
          'RecordTableNoRecordGroupBodyEffect::records not setting new records because we are probably viewing the merged view',
          records,
        );
      }
    }
  }, [records, totalCount, setRecordTableData, loading, hasCustomDataSource]);

  const fetchMoreDebouncedIfRequested = useDebouncedCallback(async () => {
    // We are debouncing here to give the user some room to scroll if they want to within this throttle window
    return await fetchMoreRecords();
  }, 100);

  useEffect(() => {
    const allRecordsHaveBeenFetched = !hasNextPage;

    setHasRecordTableFetchedAllRecordsComponents(allRecordsHaveBeenFetched);
  }, [hasNextPage, setHasRecordTableFetchedAllRecordsComponents]);

  useEffect(() => {
    (async () => {
      if (
        !isFetchingMoreObjects &&
        tableLastRowVisible &&
        hasNextPage &&
        !encounteredUnrecoverableError &&
        !hasCustomDataSource // Skip fetching more if we're using a custom data source
      ) {
        const result = await fetchMoreDebouncedIfRequested();

        const isForbidden =
          result?.error?.graphQLErrors.some(
            (e) => e.extensions?.code === 'FORBIDDEN',
          ) ?? false;

        if (isForbidden) {
          setEncounteredUnrecoverableError(true);
        }
      }
    })();
  }, [
    hasNextPage,
    records,
    lastShowPageRecordId,
    scrollToPosition,
    fetchMoreDebouncedIfRequested,
    isFetchingMoreObjects,
    tableLastRowVisible,
    encounteredUnrecoverableError,
    setEncounteredUnrecoverableError,
    hasCustomDataSource,
  ]);

  useEffect(() => {
    if (isNull(currentWorkspaceMember)) {
      return;
    }

    if (!hasInitialized && !hasCustomDataSource) {
      // Skip initialization if we're using a custom data source
      findManyRecords();
      setHasInitialized(true);
    }
  }, [
    currentWorkspaceMember,
    findManyRecords,
    hasInitialized,
    hasCustomDataSource,
  ]);

  return <></>;
};
