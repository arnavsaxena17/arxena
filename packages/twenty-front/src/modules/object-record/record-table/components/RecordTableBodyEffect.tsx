import { useCallback, useEffect, useTransition } from 'react';
import { atom, atomFamily, selectorFamily, useRecoilCallback, useRecoilState, useRecoilValue } from 'recoil';

import { useLoadRecordIndexTable } from '@/object-record/record-index/hooks/useLoadRecordIndexTable';
import { useRecordTableStates } from '@/object-record/record-table/hooks/internal/useRecordTableStates';
import { isFetchingMoreRecordsFamilyState } from '@/object-record/states/isFetchingMoreRecordsFamilyState';
import { useScrollRestoration } from '~/hooks/useScrollRestoration';
import { ApolloQueryResult } from '@apollo/client';
import { RecordGqlOperationFindManyResult } from '@/object-record/graphql/types/RecordGqlOperationFindManyResult';

type RecordTableBodyEffectProps = {
  objectNameSingular: string;
};

const refetchFunctionFamily = atomFamily({
  key: 'refetchFunctionFamily',
  // default: ()=>Promise<ApolloQueryResult<RecordGqlOperationFindManyResult>>,
  default: () => {},
});

export const getRefetchFunctionSelector = selectorFamily({
  key: 'getRefetchFunction',
  get:
    refetchId =>
    ({ get }) => {
      return get(refetchFunctionFamily(refetchId));
    },
});

export const RecordTableBodyEffect = ({ objectNameSingular }: RecordTableBodyEffectProps) => {
  const [isPending, startTransition] = useTransition();

  const { fetchMoreRecords: fetchMoreObjects, records, totalCount, setRecordTableData, queryStateIdentifier, loading, refetchRecords } = useLoadRecordIndexTable(objectNameSingular);

  // const [, setRefetchFunction] = useRecoilState(refetchFunctionAtom);

  // const setRefetchFunctionFamily = useRecoilCallback(
  //   ({ set }) =>
  //     () => {
  //       set(refetchFunctionFamily(objectNameSingular), refetchRecords);
  //     },
  //   [objectNameSingular],
  // );

  // useEffect(() => {
  //   startTransition(() => {
  //     setRefetchFunctionFamily();
  //   });
  // }, [setRefetchFunctionFamily, startTransition]);

  // const callbackRefetch = useCallback(() => {
  //   refetchRecords();
  // }, []);

  // useEffect(() => {
  //   setRefetchFunction(() => callbackRefetch);
  // }, [callbackRefetch, setRefetchFunction]);

  const { tableLastRowVisibleState } = useRecordTableStates();

  const [tableLastRowVisible, setTableLastRowVisible] = useRecoilState(tableLastRowVisibleState);

  const isFetchingMoreObjects = useRecoilValue(isFetchingMoreRecordsFamilyState(queryStateIdentifier));

  const rowHeight = 32;
  const viewportHeight = records.length * rowHeight;

  useScrollRestoration(viewportHeight);

  useEffect(() => {
    if (!loading) {
      setRecordTableData(records, totalCount);
    }
  }, [records, totalCount, setRecordTableData, loading]);

  useEffect(() => {
    if (tableLastRowVisible && !isFetchingMoreObjects) {
      fetchMoreObjects();
    }
  }, [fetchMoreObjects, isFetchingMoreObjects, setTableLastRowVisible, tableLastRowVisible]);

  return <></>;
};
