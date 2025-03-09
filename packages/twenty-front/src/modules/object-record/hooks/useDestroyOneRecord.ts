import { useApolloClient } from '@apollo/client';
import { useCallback, useState } from 'react';
import { useRecoilState } from 'recoil';

import { triggerCreateRecordsOptimisticEffect } from '@/apollo/optimistic-effect/utils/triggerCreateRecordsOptimisticEffect';
import { triggerDestroyRecordsOptimisticEffect } from '@/apollo/optimistic-effect/utils/triggerDestroyRecordsOptimisticEffect';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { useGetRecordFromCache } from '@/object-record/cache/hooks/useGetRecordFromCache';
import { useDestroyOneRecordMutation } from '@/object-record/hooks/useDestroyOneRecordMutation';
import { deleteJobFromArxena } from '@/object-record/utils/deleteJobFromArxena';
import { getDestroyOneRecordMutationResponseField } from '@/object-record/utils/getDestroyOneRecordMutationResponseField';
import { capitalize, isDefined } from 'twenty-shared';
import { useLazyFindOneRecord } from './useLazyFindOneRecord';

type useDestroyOneRecordProps = {
  objectNameSingular: string;
  refetchFindManyQuery?: boolean;
};

export const useDestroyOneRecord = ({
  objectNameSingular,
}: useDestroyOneRecordProps) => {
  const apolloClient = useApolloClient();
  const [jobApiError, setJobApiError] = useState<string | null>(null);
  const [tokenPair] = useRecoilState(tokenPairState);

  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular,
  });

  const getRecordFromCache = useGetRecordFromCache({ objectNameSingular });

  const { destroyOneRecordMutation } = useDestroyOneRecordMutation({
    objectNameSingular,
  });

  const { objectMetadataItems } = useObjectMetadataItems();

  const mutationResponseField =
    getDestroyOneRecordMutationResponseField(objectNameSingular);

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
      if (!cachedArxenaSiteId || cachedArxenaSiteId === '') {
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

  const destroyOneRecord = useCallback(
    async (idToDestroy: string) => {
      console.log('idToDestroy:', idToDestroy);
      const originalRecord = getRecordFromCache(
        idToDestroy,
        apolloClient.cache,
      );

      console.log('originalRecord:', originalRecord);

      // Get arxenaSiteId before deletion
      const arxenaSiteId = await getArxenaSiteId(idToDestroy);
      console.log('arxenaSiteId:', arxenaSiteId);
      const deletedRecord = await apolloClient
        .mutate({
          mutation: destroyOneRecordMutation,
          variables: { idToDestroy },
          optimisticResponse: {
            [mutationResponseField]: {
              __typename: capitalize(objectNameSingular),
              id: idToDestroy,
            },
          },
          update: (cache, { data }) => {
            const record = data?.[mutationResponseField];
            if (!isDefined(record)) return;

            const cachedRecord = getRecordFromCache(record.id, cache);
            if (!isDefined(cachedRecord)) return;
            triggerDestroyRecordsOptimisticEffect({
              cache,
              objectMetadataItem,
              recordsToDestroy: [cachedRecord],
              objectMetadataItems,
            });
          },
        })
        .catch((error: Error) => {
          if (isDefined(originalRecord)) {
            triggerCreateRecordsOptimisticEffect({
              cache: apolloClient.cache,
              objectMetadataItem,
              recordsToCreate: [originalRecord],
              objectMetadataItems,
            });
          }

          throw error;
        });

      // After successfully destroying the record, delete from Arxena if it's a job
      try {
        if (
          objectNameSingular === 'job' &&
          arxenaSiteId !== undefined &&
          arxenaSiteId !== null
        ) {
          try {
            console.log('arxenaSiteId:', arxenaSiteId);
            // Use the stored arxenaSiteId directly with the shared utility
            await deleteJobFromArxena({
              arxenaSiteId,
              accessToken: tokenPair?.accessToken?.token,
            });
          } catch (error) {
            setJobApiError(
              error instanceof Error
                ? error.message
                : 'Failed to delete job from Arxena',
            );
            console.log("Couldn't delete job from arxena", error);
          }
        }
      } catch (error) {
        console.log('Error deleting job from Arxena', error);
      }

      return deletedRecord.data?.[mutationResponseField] ?? null;
    },
    [
      apolloClient,
      destroyOneRecordMutation,
      getRecordFromCache,
      mutationResponseField,
      objectMetadataItem,
      objectMetadataItems,
      objectNameSingular,
      tokenPair,
      getArxenaSiteId,
    ],
  );

  return {
    destroyOneRecord,
    jobApiError,
  };
};
