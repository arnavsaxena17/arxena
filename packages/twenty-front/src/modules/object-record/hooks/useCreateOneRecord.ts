import { useApolloClient } from '@apollo/client';
import { useState } from 'react';
import { v4 } from 'uuid';

import { triggerCreateRecordsOptimisticEffect } from '@/apollo/optimistic-effect/utils/triggerCreateRecordsOptimisticEffect';
import { sendCreateJobToArxena } from '@/arx-jd-upload/utils/sendCreateJobToArxena';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { checkObjectMetadataItemHasFieldCreatedBy } from '@/object-metadata/utils/checkObjectMetadataItemHasFieldCreatedBy';
import { useCreateOneRecordInCache } from '@/object-record/cache/hooks/useCreateOneRecordInCache';
import { getObjectTypename } from '@/object-record/cache/utils/getObjectTypename';
import { getRecordNodeFromRecord } from '@/object-record/cache/utils/getRecordNodeFromRecord';
import { RecordGqlOperationGqlRecordFields } from '@/object-record/graphql/types/RecordGqlOperationGqlRecordFields';
import { generateDepthOneRecordGqlFields } from '@/object-record/graphql/utils/generateDepthOneRecordGqlFields';
import { useCreateOneRecordMutation } from '@/object-record/hooks/useCreateOneRecordMutation';
import { useRefetchAggregateQueries } from '@/object-record/hooks/useRefetchAggregateQueries';
import { FieldActorForInputValue } from '@/object-record/record-field/types/FieldMetadata';
import { ObjectRecord } from '@/object-record/types/ObjectRecord';
import { computeOptimisticRecordFromInput } from '@/object-record/utils/computeOptimisticRecordFromInput';
import { getCreateOneRecordMutationResponseField } from '@/object-record/utils/getCreateOneRecordMutationResponseField';
import { sanitizeRecordInput } from '@/object-record/utils/sanitizeRecordInput';
import { useRecoilState, useRecoilValue } from 'recoil';
import { isDefined } from 'twenty-shared';
type useCreateOneRecordProps = {
  objectNameSingular: string;
  recordGqlFields?: RecordGqlOperationGqlRecordFields;
  skipPostOptimisticEffect?: boolean;
  shouldMatchRootQueryFilter?: boolean;
};

export const useCreateOneRecord = <
  CreatedObjectRecord extends ObjectRecord = ObjectRecord,
>({
  objectNameSingular,
  recordGqlFields,
  skipPostOptimisticEffect = false,
  shouldMatchRootQueryFilter,
}: useCreateOneRecordProps) => {
  const apolloClient = useApolloClient();
  const [loading, setLoading] = useState(false);
  const [jobApiError, setJobApiError] = useState<string | null>(null);
  const [tokenPair] = useRecoilState(tokenPairState);

  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular,
  });

  const objectMetadataHasCreatedByField =
    checkObjectMetadataItemHasFieldCreatedBy(objectMetadataItem);

  const computedRecordGqlFields =
    recordGqlFields ?? generateDepthOneRecordGqlFields({ objectMetadataItem });

  const { createOneRecordMutation } = useCreateOneRecordMutation({
    objectNameSingular,
    recordGqlFields: computedRecordGqlFields,
  });

  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);

  const createOneRecordInCache = useCreateOneRecordInCache<CreatedObjectRecord>(
    {
      objectMetadataItem,
    },
  );

  const { objectMetadataItems } = useObjectMetadataItems();

  const { refetchAggregateQueries } = useRefetchAggregateQueries({
    objectMetadataNamePlural: objectMetadataItem.namePlural,
  });

  const createOneRecord = async (recordInput: Partial<CreatedObjectRecord>) => {
    setLoading(true);

    const idForCreation = recordInput.id ?? v4();

    const sanitizedInput = {
      ...sanitizeRecordInput({
        objectMetadataItem,
        recordInput,
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
    const optimisticRecordInput = computeOptimisticRecordFromInput({
      cache: apolloClient.cache,
      currentWorkspaceMember: currentWorkspaceMember,
      objectMetadataItem,
      objectMetadataItems,
      recordInput: {
        ...baseOptimisticRecordInputCreatedBy,
        ...recordInput,
        id: idForCreation,
      },
    });
    const recordCreatedInCache = createOneRecordInCache({
      ...optimisticRecordInput,
      id: idForCreation,
      __typename: getObjectTypename(objectMetadataItem.nameSingular),
    });

    if (isDefined(recordCreatedInCache)) {
      const optimisticRecordNode = getRecordNodeFromRecord({
        objectMetadataItem,
        objectMetadataItems,
        record: recordCreatedInCache,
        recordGqlFields: computedRecordGqlFields,
        computeReferences: false,
      });

      if (skipPostOptimisticEffect === false && optimisticRecordNode !== null) {
        triggerCreateRecordsOptimisticEffect({
          cache: apolloClient.cache,
          objectMetadataItem,
          recordsToCreate: [optimisticRecordNode],
          objectMetadataItems,
          shouldMatchRootQueryFilter,
        });
      }
    }

    const mutationResponseField =
      getCreateOneRecordMutationResponseField(objectNameSingular);
    const createdObject = await apolloClient.mutate({
      mutation: createOneRecordMutation,
      variables: {
        input: sanitizedInput,
      },
      update: (cache, { data }) => {
        const record = data?.[mutationResponseField];

        if (!record || skipPostOptimisticEffect) return;

        triggerCreateRecordsOptimisticEffect({
          cache,
          objectMetadataItem,
          recordsToCreate: [record],
          objectMetadataItems,
        });
        setLoading(false);
      },
    });
    try {
      console.log('This is the input', recordInput);
      if (objectNameSingular === 'job' && isDefined(recordInput?.id)) {
        try {
          await sendCreateJobToArxena(
            recordInput?.name as string,
            recordInput.id as string,
            tokenPair?.accessToken?.token || '',
          );
        } catch {
          console.log("Couldn't send job to arxena");
        }
      }
    } catch (error) {
      console.log('Error with Arxena job operations', error);
    }
    await refetchAggregateQueries();
    return createdObject.data?.[mutationResponseField] ?? null;
  };

  return {
    createOneRecord,
    loading,
  };
};
