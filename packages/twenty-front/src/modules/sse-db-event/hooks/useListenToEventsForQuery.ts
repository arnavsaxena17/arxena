import { useChangeQueryListenState } from '@/sse-db-event/hooks/useChangeQueryListenState';
import { useEffect } from 'react';
import type { MetadataGqlOperationSignature, RecordGqlOperationSignature } from 'twenty-shared/types';

export const useListenToEventsForQuery = ({
  queryId,
  operationSignature,
  skip = false,
}: {
  queryId: string;
  operationSignature:
    | RecordGqlOperationSignature
    | MetadataGqlOperationSignature;
  skip?: boolean;
}) => {
  const { changeQueryIdListenState } = useChangeQueryListenState();
  // Inline object literals in callers change identity every render; key by value
  // so we do not remove/re-add SSE listeners and trip maximum update depth.
  const operationSignatureKey = JSON.stringify(operationSignature);

  useEffect(() => {
    if (skip) {
      return;
    }

    changeQueryIdListenState(true, queryId, operationSignature);

    return () => {
      changeQueryIdListenState(false, queryId, operationSignature);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changeQueryIdListenState, queryId, operationSignatureKey, skip]);
};
