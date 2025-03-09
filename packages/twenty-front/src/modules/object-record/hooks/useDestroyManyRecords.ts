import { tokenPairState } from '@/auth/states/tokenPairState';
import { useApolloClient } from '@apollo/client';
import { useCallback, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

import { triggerCreateRecordsOptimisticEffect } from '@/apollo/optimistic-effect/utils/triggerCreateRecordsOptimisticEffect';
import { triggerDestroyRecordsOptimisticEffect } from '@/apollo/optimistic-effect/utils/triggerDestroyRecordsOptimisticEffect';
import { apiConfigState } from '@/client-config/states/apiConfigState';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { useGetRecordFromCache } from '@/object-record/cache/hooks/useGetRecordFromCache';
import { DEFAULT_MUTATION_BATCH_SIZE } from '@/object-record/constants/DefaultMutationBatchSize';
import { useDestroyManyRecordsMutation } from '@/object-record/hooks/useDestroyManyRecordsMutation';
import { useRefetchAggregateQueries } from '@/object-record/hooks/useRefetchAggregateQueries';
import { ObjectRecord } from '@/object-record/types/ObjectRecord';
import { deleteJobFromArxena } from '@/object-record/utils/deleteJobFromArxena';
import { getDestroyManyRecordsMutationResponseField } from '@/object-record/utils/getDestroyManyRecordsMutationResponseField';
import { capitalize, isDefined } from 'twenty-shared';
import { sleep } from '~/utils/sleep';
import { useLazyFindOneRecord } from './useLazyFindOneRecord';

type useDestroyManyRecordProps = {
  objectNameSingular: string;
  refetchFindManyQuery?: boolean;
};

export type DestroyManyRecordsProps = {
  recordIdsToDestroy: string[];
  skipOptimisticEffect?: boolean;
  delayInMsBetweenRequests?: number;
};

export const useDestroyManyRecords = ({
  objectNameSingular,
}: useDestroyManyRecordProps) => {
  const apiConfig = useRecoilValue(apiConfigState);
  const [jobApiError, setJobApiError] = useState<string | null>(null);
  const [tokenPair] = useRecoilState(tokenPairState);

  const mutationPageSize =
    apiConfig?.mutationMaximumAffectedRecords ?? DEFAULT_MUTATION_BATCH_SIZE;

  const apolloClient = useApolloClient();

  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular,
  });

  const getRecordFromCache = useGetRecordFromCache({ objectNameSingular });

  const { destroyManyRecordsMutation } = useDestroyManyRecordsMutation({
    objectNameSingular,
  });

  const { objectMetadataItems } = useObjectMetadataItems();

  const { refetchAggregateQueries } = useRefetchAggregateQueries({
    objectMetadataNamePlural: objectMetadataItem.namePlural,
  });

  const mutationResponseField = getDestroyManyRecordsMutationResponseField(
    objectMetadataItem.namePlural,
  );

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

  const destroyManyRecords = useCallback(
    async ({
      recordIdsToDestroy,
      delayInMsBetweenRequests,
      skipOptimisticEffect = false,
    }: DestroyManyRecordsProps) => {
      // Store arxenaSiteIds before destruction
      const recordIdToArxenaSiteIdMap = new Map<
        string,
        string | null | undefined
      >();

      if (objectNameSingular === 'job') {
        for (const recordId of recordIdsToDestroy) {
          // First try to get from cache
          const cachedRecord = getRecordFromCache(recordId, apolloClient.cache);

          if (
            cachedRecord?.arxenaSiteId !== undefined &&
            cachedRecord?.arxenaSiteId !== null
          ) {
            recordIdToArxenaSiteIdMap.set(recordId, cachedRecord.arxenaSiteId);
          } else {
            // If not in cache, fetch from backend
            try {
              const arxenaSiteId = await getArxenaSiteId(recordId);
              if (arxenaSiteId !== undefined && arxenaSiteId !== null) {
                recordIdToArxenaSiteIdMap.set(recordId, arxenaSiteId);
              }
            } catch (error) {
              console.error(
                `Error fetching arxenaSiteId for record ${recordId}:`,
                error,
              );
            }
          }
        }
      }

      const numberOfBatches = Math.ceil(
        recordIdsToDestroy.length / mutationPageSize,
      );

      const destroyedRecords = [];

      for (let batchIndex = 0; batchIndex < numberOfBatches; batchIndex++) {
        const batchedIdToDestroy = recordIdsToDestroy.slice(
          batchIndex * mutationPageSize,
          (batchIndex + 1) * mutationPageSize,
        );

        const cachedRecords = batchedIdToDestroy
          .map((recordId) => getRecordFromCache(recordId, apolloClient.cache))
          .filter(isDefined);

        const destroyedRecordsResponse = await apolloClient
          .mutate<Record<string, ObjectRecord[]>>({
            mutation: destroyManyRecordsMutation,
            variables: {
              filter: { id: { in: batchedIdToDestroy } },
            },
            optimisticResponse: skipOptimisticEffect
              ? undefined
              : {
                  [mutationResponseField]: batchedIdToDestroy.map(
                    (idToDestroy) => ({
                      __typename: capitalize(objectNameSingular),
                      id: idToDestroy,
                    }),
                  ),
                },
            update: (cache, { data }) => {
              if (skipOptimisticEffect) {
                return;
              }
              const records = data?.[mutationResponseField];

              if (!isDefined(records) || records.length === 0) return;

              const cachedRecords = records
                .map((record) => getRecordFromCache(record.id, cache))
                .filter(isDefined);

              triggerDestroyRecordsOptimisticEffect({
                cache,
                objectMetadataItem,
                recordsToDestroy: cachedRecords,
                objectMetadataItems,
              });
            },
          })
          .catch((error: Error) => {
            if (cachedRecords.length > 0 && !skipOptimisticEffect) {
              triggerCreateRecordsOptimisticEffect({
                cache: apolloClient.cache,
                objectMetadataItem,
                recordsToCreate: cachedRecords,
                objectMetadataItems,
              });
            }
            throw error;
          });

        const destroyedRecordsForThisBatch =
          destroyedRecordsResponse.data?.[mutationResponseField] ?? [];

        destroyedRecords.push(...destroyedRecordsForThisBatch);

        if (isDefined(delayInMsBetweenRequests)) {
          await sleep(delayInMsBetweenRequests);
        }
      }

      // After successfully destroying records, delete from Arxena if they are jobs
      try {
        if (objectNameSingular === 'job') {
          for (const recordId of recordIdsToDestroy) {
            // Use the pre-stored arxenaSiteId instead of fetching it again
            const arxenaSiteId = recordIdToArxenaSiteIdMap.get(recordId);

            if (arxenaSiteId !== undefined && arxenaSiteId !== null) {
              try {
                await deleteJobFromArxena({
                  arxenaSiteId,
                  accessToken: tokenPair?.accessToken?.token,
                  delayInMsBetweenRequests,
                });
              } catch (error) {
                setJobApiError(
                  error instanceof Error
                    ? error.message
                    : 'Failed to delete job from Arxena',
                );
                console.log(
                  `Couldn't delete job ${recordId} from arxena`,
                  error,
                );
              }
            }
          }
        }
      } catch (error) {
        console.log('Error deleting jobs from Arxena', error);
      }

      await refetchAggregateQueries();
      return destroyedRecords;
    },
    [
      destroyManyRecordsMutation,
      getRecordFromCache,
      objectNameSingular,
      objectMetadataItem,
      objectMetadataItems,
      refetchAggregateQueries,
      tokenPair,
      mutationPageSize,
      apolloClient,
      mutationResponseField,
      getArxenaSiteId,
    ],
  );

  return {
    destroyManyRecords,
    jobApiError,
  };
};
