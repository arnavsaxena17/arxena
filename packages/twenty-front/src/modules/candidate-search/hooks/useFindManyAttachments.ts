import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { getRecordsFromRecordConnection } from '@/object-record/cache/utils/getRecordsFromRecordConnection';
import { type RecordGqlOperationFindManyResult } from '@/object-record/graphql/types/RecordGqlOperationFindManyResult';
import { useFindManyRecordsQuery } from '@/object-record/hooks/useFindManyRecordsQuery';
import { useCallback } from 'react';
import { QUERY_DEFAULT_LIMIT_RECORDS } from 'twenty-shared/constants';
import type { RecordGqlOperationFilter, RecordGqlOperationOrderBy } from 'twenty-shared/types';

export const useFindManyAttachments = () => {
  const apolloCoreClient = useApolloCoreClient();
  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular: 'attachment',
  });
  const { findManyRecordsQuery } = useFindManyRecordsQuery({
    objectNameSingular: 'attachment',
  });

  const findManyAttachments = useCallback(
    async (options: {
      filter: RecordGqlOperationFilter;
      orderBy: RecordGqlOperationOrderBy;
      limit?: number;
    }) => {
      const result = await apolloCoreClient.query<RecordGqlOperationFindManyResult>(
        {
          query: findManyRecordsQuery,
          variables: {
            filter: options.filter,
            orderBy: options.orderBy,
            limit: options.limit ?? QUERY_DEFAULT_LIMIT_RECORDS,
          },
        },
      );

      const records = getRecordsFromRecordConnection({
        recordConnection: {
          edges: result?.data?.[objectMetadataItem.namePlural]?.edges ?? [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: '',
            endCursor: '',
          },
        },
      });

      return records ?? [];
    },
    [apolloCoreClient, findManyRecordsQuery, objectMetadataItem.namePlural],
  );

  return { findManyAttachments };
};
