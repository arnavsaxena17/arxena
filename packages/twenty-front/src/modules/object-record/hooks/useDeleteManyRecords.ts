import { tokenPairState } from '@/auth/states/tokenPairState';
import { useApolloClient } from '@apollo/client';
import { useCallback, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

import { triggerUpdateRecordOptimisticEffectByBatch } from '@/apollo/optimistic-effect/utils/triggerUpdateRecordOptimisticEffectByBatch';
import { apiConfigState } from '@/client-config/states/apiConfigState';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { useGetRecordFromCache } from '@/object-record/cache/hooks/useGetRecordFromCache';
import { getObjectTypename } from '@/object-record/cache/utils/getObjectTypename';
import { getRecordNodeFromRecord } from '@/object-record/cache/utils/getRecordNodeFromRecord';
import { updateRecordFromCache } from '@/object-record/cache/utils/updateRecordFromCache';
import { DEFAULT_MUTATION_BATCH_SIZE } from '@/object-record/constants/DefaultMutationBatchSize';
import { RecordGqlNode } from '@/object-record/graphql/types/RecordGqlNode';
import { useDeleteManyRecordsMutation } from '@/object-record/hooks/useDeleteManyRecordsMutation';
import { useRefetchAggregateQueries } from '@/object-record/hooks/useRefetchAggregateQueries';
import { ObjectRecord } from '@/object-record/types/ObjectRecord';
import { deleteJobFromArxena } from '@/object-record/utils/deleteJobFromArxena';
import { getDeleteManyRecordsMutationResponseField } from '@/object-record/utils/getDeleteManyRecordsMutationResponseField';
import { isDefined } from 'twenty-shared';
import { sleep } from '~/utils/sleep';
import { useLazyFindOneRecord } from './useLazyFindOneRecord';

type useDeleteManyRecordProps = {
  objectNameSingular: string;
  refetchFindManyQuery?: boolean;
};

export type DeleteManyRecordsProps = {
  recordIdsToDelete: string[];
  skipOptimisticEffect?: boolean;
  delayInMsBetweenRequests?: number;
};

export const useDeleteManyRecords = ({
  objectNameSingular,
}: useDeleteManyRecordProps) => {
  const apiConfig = useRecoilValue(apiConfigState);
  const [jobApiError, setJobApiError] = useState<string | null>(null);
  const [tokenPair] = useRecoilState(tokenPairState);

  const mutationPageSize =
    apiConfig?.mutationMaximumAffectedRecords ?? DEFAULT_MUTATION_BATCH_SIZE;

  const apolloClient = useApolloClient();

  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular,
  });

  const getRecordFromCache = useGetRecordFromCache({
    objectNameSingular,
  });

  const { deleteManyRecordsMutation } = useDeleteManyRecordsMutation({
    objectNameSingular,
  });

  const { objectMetadataItems } = useObjectMetadataItems();

  const { refetchAggregateQueries } = useRefetchAggregateQueries({
    objectMetadataNamePlural: objectMetadataItem.namePlural,
  });

  const mutationResponseField =
    getDeleteManyRecordsMutationResponseField(objectNameSingular);

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

  const deleteManyRecords = useCallback(
    async ({
      recordIdsToDelete,
      delayInMsBetweenRequests,
      skipOptimisticEffect = false,
    }: DeleteManyRecordsProps) => {
      const numberOfBatches = Math.ceil(
        recordIdsToDelete.length / mutationPageSize,
      );
      const deletedRecords = [];

      // Store arxenaSiteIds before deletion
      const recordIdToArxenaSiteIdMap = new Map<
        string,
        string | null | undefined
      >();

      if (objectNameSingular === 'job') {
        for (const recordId of recordIdsToDelete) {
          // First try to get from cache
          const cachedRecord = getRecordFromCache(recordId, apolloClient.cache);

          if (
            cachedRecord?.arxenaSiteId !== undefined &&
            cachedRecord?.arxenaSiteId !== null &&
            cachedRecord?.arxenaSiteId !== ''
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

      for (let batchIndex = 0; batchIndex < numberOfBatches; batchIndex++) {
        const batchedIdsToDelete = recordIdsToDelete.slice(
          batchIndex * mutationPageSize,
          (batchIndex + 1) * mutationPageSize,
        );

        const cachedRecords = batchedIdsToDelete
          .map((idToDelete) =>
            getRecordFromCache(idToDelete, apolloClient.cache),
          )
          .filter(isDefined);
        console.log('cachedRecords:', cachedRecords);
        const currentTimestamp = new Date().toISOString();
        if (!skipOptimisticEffect) {
          const cachedRecordsNode: RecordGqlNode[] = [];
          const computedOptimisticRecordsNode: RecordGqlNode[] = [];

          const recordGqlFields = {
            deletedAt: true,
          };
          cachedRecords.forEach((cachedRecord) => {
            const cachedRecordNode = getRecordNodeFromRecord<ObjectRecord>({
              record: cachedRecord,
              objectMetadataItem,
              objectMetadataItems,
              computeReferences: false,
            });

            const computedOptimisticRecord = {
              ...cachedRecord,
              deletedAt: currentTimestamp,
              __typename: getObjectTypename(objectMetadataItem.nameSingular),
            };
            const optimisticRecordNode = getRecordNodeFromRecord<ObjectRecord>({
              record: computedOptimisticRecord,
              objectMetadataItem,
              objectMetadataItems,
              computeReferences: false,
            });

            if (
              isDefined(optimisticRecordNode) &&
              isDefined(cachedRecordNode)
            ) {
              updateRecordFromCache({
                objectMetadataItems,
                objectMetadataItem,
                cache: apolloClient.cache,
                record: computedOptimisticRecord,
                recordGqlFields,
              });

              computedOptimisticRecordsNode.push(optimisticRecordNode);
              cachedRecordsNode.push(cachedRecordNode);
            }
          });

          triggerUpdateRecordOptimisticEffectByBatch({
            cache: apolloClient.cache,
            objectMetadataItem,
            currentRecords: cachedRecordsNode,
            updatedRecords: computedOptimisticRecordsNode,
            objectMetadataItems,
          });
        }

        const deletedRecordsResponse = await apolloClient
          .mutate<Record<string, ObjectRecord[]>>({
            mutation: deleteManyRecordsMutation,
            variables: {
              filter: { id: { in: batchedIdsToDelete } },
            },
          })
          .catch((error: Error) => {
            if (skipOptimisticEffect) {
              throw error;
            }

            const cachedRecordsNode: RecordGqlNode[] = [];
            const computedOptimisticRecordsNode: RecordGqlNode[] = [];

            const recordGqlFields = {
              deletedAt: true,
            };
            cachedRecords.forEach((cachedRecord) => {
              updateRecordFromCache({
                objectMetadataItems,
                objectMetadataItem,
                cache: apolloClient.cache,
                record: { ...cachedRecord, deletedAt: null },
                recordGqlFields,
              });

              const cachedRecordWithConnection =
                getRecordNodeFromRecord<ObjectRecord>({
                  record: cachedRecord,
                  objectMetadataItem,
                  objectMetadataItems,
                  computeReferences: false,
                });

              const computedOptimisticRecord = {
                ...cachedRecord,
                deletedAt: currentTimestamp,
                __typename: getObjectTypename(objectMetadataItem.nameSingular),
              };

              const optimisticRecordWithConnection =
                getRecordNodeFromRecord<ObjectRecord>({
                  record: computedOptimisticRecord,
                  objectMetadataItem,
                  objectMetadataItems,
                  computeReferences: false,
                });

              if (
                isDefined(optimisticRecordWithConnection) &&
                isDefined(cachedRecordWithConnection)
              ) {
                cachedRecordsNode.push(cachedRecordWithConnection);
                computedOptimisticRecordsNode.push(
                  optimisticRecordWithConnection,
                );
              }
            });

            triggerUpdateRecordOptimisticEffectByBatch({
              cache: apolloClient.cache,
              objectMetadataItem,
              currentRecords: computedOptimisticRecordsNode,
              updatedRecords: cachedRecordsNode,
              objectMetadataItems,
            });

            throw error;
          });

        const deletedRecordsForThisBatch =
          deletedRecordsResponse.data?.[mutationResponseField] ?? [];
        deletedRecords.push(...deletedRecordsForThisBatch);

        if (isDefined(delayInMsBetweenRequests)) {
          await sleep(delayInMsBetweenRequests);
        }
      }

      // After successfully deleting records, delete from Arxena if they are jobs
      try {
        if (objectNameSingular === 'job') {
          for (const recordId of recordIdsToDelete) {
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
      return deletedRecords;
    },
    [
      deleteManyRecordsMutation,
      getRecordFromCache,
      mutationResponseField,
      objectMetadataItem,
      objectMetadataItems,
      objectNameSingular,
      getArxenaSiteId,
      refetchAggregateQueries,
      tokenPair,
      mutationPageSize,
      apolloClient,
    ],
  );

  return {
    deleteManyRecords,
    jobApiError,
  };
};
