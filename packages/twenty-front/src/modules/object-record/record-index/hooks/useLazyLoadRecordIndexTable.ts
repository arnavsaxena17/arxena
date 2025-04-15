import { useRecoilState, useRecoilValue } from 'recoil';

import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useLazyFindManyRecords } from '@/object-record/hooks/useLazyFindManyRecords';
import { useFindManyRecordIndexTableParams } from '@/object-record/record-index/hooks/useFindManyRecordIndexTableParams';
import { useRecordTableRecordGqlFields } from '@/object-record/record-index/hooks/useRecordTableRecordGqlFields';
import { useRecordTable } from '@/object-record/record-table/hooks/useRecordTable';
import { recordTableRefetchFunctionState } from '@/object-record/record-table/states/refetchFunctionAtom';
import { SIGN_IN_BACKGROUND_MOCK_COMPANIES } from '@/sign-in-background-mock/constants/SignInBackgroundMockCompanies';
import { useEffect } from 'react';
import { isWorkspaceActiveOrSuspended } from 'twenty-shared';

export const useLazyLoadRecordIndexTable = (objectNameSingular: string) => {
  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular,
  });

  const { setRecordTableData, setIsRecordTableInitialLoading } =
    useRecordTable();

  const currentWorkspace = useRecoilValue(currentWorkspaceState);

  const params = useFindManyRecordIndexTableParams(objectNameSingular);

  const recordGqlFields = useRecordTableRecordGqlFields({ objectMetadataItem });

  const {
    findManyRecords,
    records,
    loading,
    totalCount,
    fetchMoreRecords,
    queryStateIdentifier,
    hasNextPage,
    refetchRecords,
  } = useLazyFindManyRecords({
    ...params,
    recordGqlFields,
    onCompleted: () => {
      setIsRecordTableInitialLoading(false);
    },
    onError: () => {
      setIsRecordTableInitialLoading(false);
    },
  });

  const [, setRecordTableRefetchFunction] = useRecoilState(
    recordTableRefetchFunctionState,
  );

  useEffect(() => {
    setRecordTableRefetchFunction(() => refetchRecords);
  }, [objectNameSingular]);

  return {
    findManyRecords,
    records: isWorkspaceActiveOrSuspended(currentWorkspace)
      ? records
      : SIGN_IN_BACKGROUND_MOCK_COMPANIES,
    totalCount: totalCount,
    loading,
    fetchMoreRecords,
    queryStateIdentifier,
    setRecordTableData,
    hasNextPage,
    refetchRecords,
  };
};
