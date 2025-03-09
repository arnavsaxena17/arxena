import { useApolloClient } from '@apollo/client';
import { useCallback, useState } from 'react';
import { useRecoilState } from 'recoil';

import { triggerUpdateRecordOptimisticEffect } from '@/apollo/optimistic-effect/utils/triggerUpdateRecordOptimisticEffect';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { useGetRecordFromCache } from '@/object-record/cache/hooks/useGetRecordFromCache';
import { getObjectTypename } from '@/object-record/cache/utils/getObjectTypename';
import { getRecordNodeFromRecord } from '@/object-record/cache/utils/getRecordNodeFromRecord';
import { updateRecordFromCache } from '@/object-record/cache/utils/updateRecordFromCache';
import { useDeleteOneRecordMutation } from '@/object-record/hooks/useDeleteOneRecordMutation';
import { useRefetchAggregateQueries } from '@/object-record/hooks/useRefetchAggregateQueries';
import { ObjectRecord } from '@/object-record/types/ObjectRecord';
import { deleteJobFromArxena } from '@/object-record/utils/deleteJobFromArxena';
import { getDeleteOneRecordMutationResponseField } from '@/object-record/utils/getDeleteOneRecordMutationResponseField';
import { isNull } from '@sniptt/guards';
import { isDefined } from 'twenty-shared';
import { useLazyFindOneRecord } from './useLazyFindOneRecord';

type useDeleteOneRecordProps = {
  objectNameSingular: string;
};

export const useDeleteOneRecord = ({
  objectNameSingular,
}: useDeleteOneRecordProps) => {
  const apolloClient = useApolloClient();
  const [jobApiError, setJobApiError] = useState<string | null>(null);
  const [tokenPair] = useRecoilState(tokenPairState);

  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular,
  });

  const getRecordFromCache = useGetRecordFromCache({
    objectNameSingular,
  });

  const { deleteOneRecordMutation } = useDeleteOneRecordMutation({
    objectNameSingular,
  });

  const { objectMetadataItems } = useObjectMetadataItems();

  const { refetchAggregateQueries } = useRefetchAggregateQueries({
    objectMetadataNamePlural: objectMetadataItem.namePlural,
  });

  const mutationResponseField =
    getDeleteOneRecordMutationResponseField(objectNameSingular);

  const { findOneRecord } = useLazyFindOneRecord({
    objectNameSingular,
  });

  const getArxenaSiteId = useCallback(
    async (recordId: string): Promise<string | undefined | null> => {
      // First try to get from cache
      const cachedArxenaSiteId = getRecordFromCache(
        recordId,
        apolloClient.cache,
      )?.arxenaSiteId;

      // If not in cache, fetch the record to get the arxenaSiteId
      if (!cachedArxenaSiteId) {
        try {
          let fetchedRecord: any;

          await findOneRecord({
            objectRecordId: recordId,
            onCompleted: (record) => {
              fetchedRecord = record;
            },
          });

          if (fetchedRecord !== undefined && 'arxenaSiteId' in fetchedRecord) {
            return fetchedRecord.arxenaSiteId;
          }
        } catch (error) {
          console.error('Error fetching record for arxenaSiteId:', error);
        }
      }

      return cachedArxenaSiteId;
    },
    [apolloClient.cache, findOneRecord, getRecordFromCache],
  );

  const deleteOneRecord = useCallback(
    async (idToDelete: string) => {
      // Store arxenaSiteId before deletion
      let arxenaSiteId: string | undefined | null = undefined;

      if (objectNameSingular === 'job') {
        // First try to get from cache
        const cachedRecord = getRecordFromCache(idToDelete, apolloClient.cache);

        if (
          cachedRecord?.arxenaSiteId !== undefined &&
          cachedRecord?.arxenaSiteId !== null &&
          cachedRecord?.arxenaSiteId !== ''
        ) {
          arxenaSiteId = cachedRecord.arxenaSiteId;
          console.log('arxenaSiteId:', arxenaSiteId);
        } else {
          // If not in cache, fetch from backend
          try {
            arxenaSiteId = await getArxenaSiteId(idToDelete);
            console.log('arxenaSiteId:', arxenaSiteId);
          } catch (error) {
            console.error(
              `Error fetching arxenaSiteId for record ${idToDelete}:`,
              error,
            );
          }
        }
      }

      const cachedRecord = getRecordFromCache(idToDelete, apolloClient.cache);
      console.log('cachedRecord:', cachedRecord);

      const cachedRecordNode = getRecordNodeFromRecord<ObjectRecord>({
        record: cachedRecord,
        objectMetadataItem,
        objectMetadataItems,
        computeReferences: false,
      });

      const currentTimestamp = new Date().toISOString();
      const computedOptimisticRecord = {
        ...cachedRecord,
        id: idToDelete,
        deletedAt: currentTimestamp,
        __typename: getObjectTypename(objectMetadataItem.nameSingular),
      };
      const optimisticRecordNode = getRecordNodeFromRecord<ObjectRecord>({
        record: computedOptimisticRecord,
        objectMetadataItem,
        objectMetadataItems,
        computeReferences: false,
      });

      const shouldHandleOptimisticCache =
        !isNull(cachedRecord) &&
        isDefined(optimisticRecordNode) &&
        isDefined(cachedRecordNode);

      if (shouldHandleOptimisticCache) {
        const recordGqlFields = {
          deletedAt: true,
        };
        updateRecordFromCache({
          objectMetadataItems,
          objectMetadataItem,
          cache: apolloClient.cache,
          record: computedOptimisticRecord,
          recordGqlFields,
        });

        triggerUpdateRecordOptimisticEffect({
          cache: apolloClient.cache,
          objectMetadataItem,
          currentRecord: cachedRecordNode,
          updatedRecord: optimisticRecordNode,
          objectMetadataItems,
        });
      }

      const deletedRecord = await apolloClient
        .mutate({
          mutation: deleteOneRecordMutation,
          variables: {
            idToDelete: idToDelete,
          },
          update: (cache, { data }) => {
            const record = data?.[mutationResponseField];
            if (!isDefined(record) || !shouldHandleOptimisticCache) {
              return;
            }

            triggerUpdateRecordOptimisticEffect({
              cache,
              objectMetadataItem,
              currentRecord: optimisticRecordNode,
              updatedRecord: record,
              objectMetadataItems,
            });
          },
        })
        .catch((error: Error) => {
          if (!shouldHandleOptimisticCache) {
            throw error;
          }

          const recordGqlFields = {
            deletedAt: true,
          };
          updateRecordFromCache({
            objectMetadataItems,
            objectMetadataItem,
            cache: apolloClient.cache,
            record: {
              ...cachedRecord,
              deletedAt: null,
            },
            recordGqlFields,
          });

          triggerUpdateRecordOptimisticEffect({
            cache: apolloClient.cache,
            objectMetadataItem,
            currentRecord: optimisticRecordNode,
            updatedRecord: cachedRecordNode,
            objectMetadataItems,
          });

          throw error;
        });

      // After successfully deleting the record, delete from Arxena if it's a job
      try {
        if (
          objectNameSingular === 'job' &&
          arxenaSiteId !== undefined &&
          arxenaSiteId !== null
        ) {
          await deleteJobFromArxena({
            arxenaSiteId,
            accessToken: tokenPair?.accessToken?.token,
          });
        }
      } catch (error) {
        setJobApiError(
          error instanceof Error
            ? error.message
            : 'Failed to delete job from Arxena',
        );
        console.log('Error deleting job from arxena', error);
      }

      await refetchAggregateQueries();
      return deletedRecord.data?.[mutationResponseField] ?? null;
    },
    [
      apolloClient,
      deleteOneRecordMutation,
      getRecordFromCache,
      mutationResponseField,
      objectMetadataItem,
      objectMetadataItems,
      objectNameSingular,
      refetchAggregateQueries,
      tokenPair,
      getArxenaSiteId,
    ],
  );

  return {
    deleteOneRecord,
    jobApiError,
  };
};
