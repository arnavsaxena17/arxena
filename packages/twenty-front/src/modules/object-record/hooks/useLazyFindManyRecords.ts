import { useLazyQuery } from '@apollo/client';
import { useRecoilCallback, useRecoilState, useSetRecoilState } from 'recoil';

import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { getRecordsFromRecordConnection } from '@/object-record/cache/utils/getRecordsFromRecordConnection';
import { RecordGqlOperationFindManyResult } from '@/object-record/graphql/types/RecordGqlOperationFindManyResult';
import { useFetchMoreRecordsWithPagination } from '@/object-record/hooks/useFetchMoreRecordsWithPagination';
import { UseFindManyRecordsParams } from '@/object-record/hooks/useFindManyRecords';
import { useFindManyRecordsQuery } from '@/object-record/hooks/useFindManyRecordsQuery';
import { useHandleFindManyRecordsCompleted } from '@/object-record/hooks/useHandleFindManyRecordsCompleted';
import { useHandleFindManyRecordsError } from '@/object-record/hooks/useHandleFindManyRecordsError';
import { cursorFamilyState } from '@/object-record/states/cursorFamilyState';
import { hasNextPageFamilyState } from '@/object-record/states/hasNextPageFamilyState';
import { isFetchingMoreRecordsFamilyState } from '@/object-record/states/isFetchingMoreRecordsFamilyState';
import { ObjectRecord } from '@/object-record/types/ObjectRecord';
import { getQueryIdentifier } from '@/object-record/utils/getQueryIdentifier';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useCallback } from 'react';
import { logError } from '~/utils/logError';

type UseLazyFindManyRecordsParams<T> = Omit<
  UseFindManyRecordsParams<T>,
  'skip'
>;

export const useLazyFindManyRecords = <T extends ObjectRecord = ObjectRecord>({
  objectNameSingular,
  filter,
  orderBy,
  limit,
  recordGqlFields,
  fetchPolicy,
  onCompleted,
  onError,
}: UseLazyFindManyRecordsParams<T>) => {
  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular,
  });
  const findManyQueryStateIdentifier = objectNameSingular + JSON.stringify(filter) + JSON.stringify(orderBy) + limit;
  const [lastCursor, setLastCursor] = useRecoilState(cursorFamilyState(findManyQueryStateIdentifier));

  // const [hasNextPage, setHasNextPage] = useRecoilState(hasNextPageFamilyState(findManyQueryStateIdentifier));
  const { enqueueSnackBar } = useSnackBar();


  const setIsFetchingMoreObjects = useSetRecoilState(isFetchingMoreRecordsFamilyState(findManyQueryStateIdentifier));

  const { findManyRecordsQuery } = useFindManyRecordsQuery({
    objectNameSingular,
    recordGqlFields,
  });

  const { handleFindManyRecordsError } = useHandleFindManyRecordsError({
    objectMetadataItem,
    handleError: onError,
  });

  const queryIdentifier = getQueryIdentifier({
    objectNameSingular,
    filter,
    orderBy,
    limit,
  });

  const { handleFindManyRecordsCompleted } = useHandleFindManyRecordsCompleted({
    objectMetadataItem,
    queryIdentifier,
    onCompleted,
  });

  const [findManyRecords, { data, loading, error, fetchMore, refetch }] =
    useLazyQuery<RecordGqlOperationFindManyResult>(findManyRecordsQuery, {
      variables: {
        filter,
        limit,
        orderBy,
      },
      fetchPolicy: fetchPolicy,
      onCompleted: handleFindManyRecordsCompleted,
      onError: handleFindManyRecordsError,
    });

  const { fetchMoreRecords, totalCount, records, hasNextPage } =
    useFetchMoreRecordsWithPagination<T>({
      objectNameSingular,
      filter,
      orderBy,
      limit,
      onCompleted,
      fetchMore,
      data,
      error,
      objectMetadataItem,
    });

  const findManyRecordsLazy = useRecoilCallback(
    ({ set }) =>
      async () => {
        const result = await findManyRecords();

        const hasNextPage =
          result?.data?.[objectMetadataItem.namePlural]?.pageInfo.hasNextPage ??
          false;

        const lastCursor =
          result?.data?.[objectMetadataItem.namePlural]?.pageInfo.endCursor ??
          '';

        set(hasNextPageFamilyState(queryIdentifier), hasNextPage);
        set(cursorFamilyState(queryIdentifier), lastCursor);

        return result;
      },
    [queryIdentifier, findManyRecords, objectMetadataItem],
  );

  const refetchRecords = useCallback(async () => {
    // console.log('objectMetadataItem.namePlural', objectMetadataItem.namePlural);

    setIsFetchingMoreObjects(true);
    try {
      const result = await refetch();

      if (result.data) {
        const pageInfo = result.data[objectMetadataItem.namePlural]?.pageInfo;
        const records = getRecordsFromRecordConnection({
          recordConnection: result.data[objectMetadataItem.namePlural],
        }) as T[];

        onCompleted?.(records, {
          pageInfo,
          totalCount: result.data[objectMetadataItem.namePlural]?.totalCount,
        });

        setLastCursor(pageInfo.endCursor ?? '');
        // setHasNextPage(pageInfo.hasNextPage ?? false);
      }

      return result;
    } catch (error: any) {
      logError(`refetchRecords for "${objectMetadataItem.namePlural}" error: ${error}`);
      enqueueSnackBar(`Error during refetchRecords for "${objectMetadataItem.namePlural}", ${error}`, {
        variant: SnackBarVariant.Error,
      });
      onError?.(error);
      throw error;
    } finally {
      setIsFetchingMoreObjects(false);
    }
  }, [refetch, objectMetadataItem.namePlural, setIsFetchingMoreObjects, onCompleted, setLastCursor, enqueueSnackBar, onError]);



  

  return {
    objectMetadataItem,
    records,
    totalCount,
    loading,
    error,
    fetchMore,
    fetchMoreRecords,
    queryStateIdentifier: queryIdentifier,
    findManyRecords: findManyRecordsLazy,
    hasNextPage,
    refetchRecords,
  };
};
