import { useApolloClient } from '@apollo/client';
import { v4 } from 'uuid';

import { triggerCreateRecordsOptimisticEffect } from '@/apollo/optimistic-effect/utils/triggerCreateRecordsOptimisticEffect';
import { triggerDestroyRecordsOptimisticEffect } from '@/apollo/optimistic-effect/utils/triggerDestroyRecordsOptimisticEffect';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { ObjectMetadataItemNotFoundError } from '@/object-metadata/errors/ObjectMetadataNotFoundError';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { useOptionalObjectMetadataItem } from '@/object-metadata/hooks/useOptionalObjectMetadataItem';
import { checkObjectMetadataItemHasFieldCreatedBy } from '@/object-metadata/utils/checkObjectMetadataItemHasFieldCreatedBy';
import { useCreateOneRecordInCache } from '@/object-record/cache/hooks/useCreateOneRecordInCache';
import { deleteRecordFromCache } from '@/object-record/cache/utils/deleteRecordFromCache';
import { getObjectTypename } from '@/object-record/cache/utils/getObjectTypename';
import { getRecordNodeFromRecord } from '@/object-record/cache/utils/getRecordNodeFromRecord';
import { RecordGqlOperationGqlRecordFields } from '@/object-record/graphql/types/RecordGqlOperationGqlRecordFields';
import { generateDepthOneRecordGqlFields } from '@/object-record/graphql/utils/generateDepthOneRecordGqlFields';
import { useCreateManyRecordsMutation } from '@/object-record/hooks/useCreateManyRecordsMutation';
import { useRefetchAggregateQueries } from '@/object-record/hooks/useRefetchAggregateQueries';
import { FieldActorForInputValue } from '@/object-record/record-field/types/FieldMetadata';
import { ObjectRecord } from '@/object-record/types/ObjectRecord';
import { computeOptimisticRecordFromInput } from '@/object-record/utils/computeOptimisticRecordFromInput';
import { getCreateManyRecordsMutationResponseField } from '@/object-record/utils/getCreateManyRecordsMutationResponseField';
import { sanitizeRecordInput } from '@/object-record/utils/sanitizeRecordInput';
import { useMemo } from 'react';
import { useRecoilValue } from 'recoil';
import { isDefined } from 'twenty-shared';

type PartialObjectRecordWithId = Partial<ObjectRecord> & {
  id: string;
};

type useCreateManyRecordsProps = {
  objectNameSingular: string;
  recordGqlFields?: RecordGqlOperationGqlRecordFields;
  skipPostOptimisticEffect?: boolean;
  shouldMatchRootQueryFilter?: boolean;
};

export const useCreateManyRecords = <
  CreatedObjectRecord extends ObjectRecord = ObjectRecord,
>({
  objectNameSingular,
  recordGqlFields,
  skipPostOptimisticEffect = false,
  shouldMatchRootQueryFilter,
}: useCreateManyRecordsProps) => {
  const apolloClient = useApolloClient();

  const { objectMetadataItem, isWorkflowAccessBlocked } =
    useOptionalObjectMetadataItem({
      objectNameSingular,
    });

  const { objectMetadataItems } = useObjectMetadataItems();

  const metadataItemForDependentHooks = useMemo(() => {
    if (isDefined(objectMetadataItem)) {
      return objectMetadataItem;
    }
    return (
      objectMetadataItems.find(
        (item) => item.nameSingular === 'workspaceMember' && item.isActive,
      ) ??
      objectMetadataItems.find((item) => item.isActive) ??
      objectMetadataItems[0]
    );
  }, [objectMetadataItem, objectMetadataItems]);

  const objectMetadataHasCreatedByField =
    isDefined(objectMetadataItem) &&
    checkObjectMetadataItemHasFieldCreatedBy(objectMetadataItem);

  const computedRecordGqlFields = isDefined(objectMetadataItem)
    ? recordGqlFields ?? generateDepthOneRecordGqlFields({ objectMetadataItem })
    : undefined;

  const { createManyRecordsMutation } = useCreateManyRecordsMutation({
    objectNameSingular,
    recordGqlFields: computedRecordGqlFields,
  });

  const createOneRecordInCache = useCreateOneRecordInCache<ObjectRecord>({
    objectMetadataItem: metadataItemForDependentHooks as NonNullable<
      typeof metadataItemForDependentHooks
    >,
  });

  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);

  const { refetchAggregateQueries } = useRefetchAggregateQueries({
    objectMetadataNamePlural:
      objectMetadataItem?.namePlural ??
      metadataItemForDependentHooks?.namePlural ??
      'workspaceMembers',
  });

  const createManyRecords = async (
    recordsToCreate: Partial<CreatedObjectRecord>[],
    upsert?: boolean,
  ) => {
    if (isWorkflowAccessBlocked) {
      throw new Error(
        'Workflow is not enabled. If you want to use it, please enable it in the lab.',
      );
    }

    if (!isDefined(objectMetadataItem)) {
      throw new ObjectMetadataItemNotFoundError(
        objectNameSingular,
        objectMetadataItems,
      );
    }

    const sanitizedCreateManyRecordsInput: PartialObjectRecordWithId[] = [];
    const recordOptimisticRecordsInput: PartialObjectRecordWithId[] = [];
    recordsToCreate.forEach((recordToCreate) => {
      const idForCreation = recordToCreate?.id ?? v4();
      const sanitizedRecord = {
        ...sanitizeRecordInput({
          objectMetadataItem,
          recordInput: recordToCreate,
        }),
        id: idForCreation,
      };
      const baseOptimisticRecordInputCreatedBy:
        | { createdBy: FieldActorForInputValue }
        | undefined = objectMetadataHasCreatedByField
        ? {
            createdBy: {
              source: 'MANUAL',
              context: {},
            },
          }
        : undefined;
      const optimisticRecordInput = {
        ...computeOptimisticRecordFromInput({
          cache: apolloClient.cache,
          objectMetadataItem,
          objectMetadataItems,
          currentWorkspaceMember: currentWorkspaceMember,
          recordInput: {
            ...baseOptimisticRecordInputCreatedBy,
            ...recordToCreate,
          },
        }),
        id: idForCreation,
      };

      sanitizedCreateManyRecordsInput.push(sanitizedRecord);
      recordOptimisticRecordsInput.push(optimisticRecordInput);
    });

    const recordsCreatedInCache = recordOptimisticRecordsInput
      .map((recordToCreate) =>
        createOneRecordInCache({
          ...recordToCreate,
          __typename: getObjectTypename(objectMetadataItem.nameSingular),
        }),
      )
      .filter(isDefined);

    if (recordsCreatedInCache.length > 0) {
      const recordNodeCreatedInCache = recordsCreatedInCache
        .map((record) =>
          getRecordNodeFromRecord({
            objectMetadataItem,
            objectMetadataItems,
            record: record,
            computeReferences: false,
          }),
        )
        .filter(isDefined);

      triggerCreateRecordsOptimisticEffect({
        cache: apolloClient.cache,
        objectMetadataItem,
        recordsToCreate: recordNodeCreatedInCache,
        objectMetadataItems,
        shouldMatchRootQueryFilter,
      });
    }

    const mutationResponseField = getCreateManyRecordsMutationResponseField(
      objectMetadataItem.namePlural,
    );

    const createdObjects = await apolloClient
      .mutate({
        mutation: createManyRecordsMutation,
        variables: {
          data: sanitizedCreateManyRecordsInput,
          upsert: upsert,
        },
        update: (cache, { data }) => {
          const records = data?.[mutationResponseField];

          if (!isDefined(records?.length) || skipPostOptimisticEffect) return;

          triggerCreateRecordsOptimisticEffect({
            cache,
            objectMetadataItem,
            recordsToCreate: records,
            objectMetadataItems,
            shouldMatchRootQueryFilter,
            checkForRecordInCache: true,
          });
        },
      })
      .catch((error: Error) => {
        recordsCreatedInCache.forEach((recordToDestroy) => {
          deleteRecordFromCache({
            objectMetadataItems,
            objectMetadataItem,
            cache: apolloClient.cache,
            recordToDestroy,
          });
        });

        triggerDestroyRecordsOptimisticEffect({
          cache: apolloClient.cache,
          objectMetadataItem,
          recordsToDestroy: recordsCreatedInCache,
          objectMetadataItems,
        });

        throw error;
      });

    await refetchAggregateQueries();
    return createdObjects.data?.[mutationResponseField] ?? [];
  };

  return { createManyRecords };
};
