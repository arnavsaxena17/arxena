import { useApolloClient } from '@apollo/client';

import { triggerUpdateRecordOptimisticEffect } from '@/apollo/optimistic-effect/utils/triggerUpdateRecordOptimisticEffect';
import { sendUpdateJobToArxena } from '@/arx-jd-upload/utils/sendUpdateJobToArxena';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { objectMetadataItemsState } from '@/object-metadata/states/objectMetadataItemsState';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';
import { useGetRecordFromCache } from '@/object-record/cache/hooks/useGetRecordFromCache';
import { getObjectTypename } from '@/object-record/cache/utils/getObjectTypename';
import { getRecordNodeFromRecord } from '@/object-record/cache/utils/getRecordNodeFromRecord';
import { updateRecordFromCache } from '@/object-record/cache/utils/updateRecordFromCache';
import { generateDepthOneRecordGqlFields } from '@/object-record/graphql/utils/generateDepthOneRecordGqlFields';
import { useRefetchAggregateQueries } from '@/object-record/hooks/useRefetchAggregateQueries';
import { useUpdateOneRecordMutation } from '@/object-record/hooks/useUpdateOneRecordMutation';
import { ObjectRecord } from '@/object-record/types/ObjectRecord';
import { computeOptimisticRecordFromInput } from '@/object-record/utils/computeOptimisticRecordFromInput';
import { getUpdateOneRecordMutationResponseField } from '@/object-record/utils/getUpdateOneRecordMutationResponseField';
import { sanitizeRecordInput } from '@/object-record/utils/sanitizeRecordInput';
// import { useUpdateViewField } from '@/views/hooks/useUpdateViewField';
import { isNull } from '@sniptt/guards';
import { useRecoilState, useRecoilValue } from 'recoil';
import { isDefined } from 'twenty-shared';
import { buildRecordFromKeysWithSameValue } from '~/utils/array/buildRecordFromKeysWithSameValue';

type useUpdateOneRecordProps = {
  objectNameSingular: string;
  recordGqlFields?: Record<string, any>;
};

type PhoneNumberInput = {
  primaryPhoneNumber?: string;
  primaryPhoneCallingCode?: string;
  primaryPhoneCountryCode?: string;
};

type UpdateOneRecordArgs<UpdatedObjectRecord> = {
  idToUpdate: string;
  updateOneRecordInput: Partial<Omit<UpdatedObjectRecord, 'id'>>;
  optimisticRecord?: Partial<ObjectRecord>;
};

export const useUpdateOneRecord = <
  UpdatedObjectRecord extends ObjectRecord = ObjectRecord,
>({
  objectNameSingular,
  recordGqlFields,
}: useUpdateOneRecordProps) => {
  const apolloClient = useApolloClient();
  // const { updateViewField } = useUpdateViewField();
  const objectMetadataItems = useRecoilValue(objectMetadataItemsState);
  const [tokenPair] = useRecoilState(tokenPairState);

  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular,
  });

  const computedRecordGqlFields =
    recordGqlFields ?? generateDepthOneRecordGqlFields({ objectMetadataItem });

  const getRecordFromCache = useGetRecordFromCache({
    objectNameSingular,
  });

  const { updateOneRecordMutation } = useUpdateOneRecordMutation({
    objectNameSingular,
    recordGqlFields: computedRecordGqlFields,
  });

  const { updateOneRecordMutation: updateViewFieldMutation } = useUpdateOneRecordMutation({
    objectNameSingular: CoreObjectNameSingular.ViewField,
  });

  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);

  // Get person update mutation at the top level
  const personObjectMetadataItem = objectMetadataItems.find(
    (item) => item.nameSingular === 'person'
  );

  const { updateOneRecordMutation: updatePersonMutation } = useUpdateOneRecordMutation({
    objectNameSingular: 'person',
    recordGqlFields: personObjectMetadataItem 
      ? generateDepthOneRecordGqlFields({ objectMetadataItem: personObjectMetadataItem })
      : undefined,
  });

  const { refetchAggregateQueries } = useRefetchAggregateQueries({
    objectMetadataNamePlural: objectMetadataItem.namePlural,
  });

  const updateOneRecord = async ({
    idToUpdate,
    updateOneRecordInput,
    optimisticRecord,
  }: UpdateOneRecordArgs<UpdatedObjectRecord>) => {
    const optimisticRecordInput =
      optimisticRecord ??
      computeOptimisticRecordFromInput({
        objectMetadataItem,
        currentWorkspaceMember: currentWorkspaceMember,
        recordInput: updateOneRecordInput,
        cache: apolloClient.cache,
        objectMetadataItems,
      });
    const cachedRecord = getRecordFromCache<ObjectRecord>(idToUpdate);
    const cachedRecordWithConnection = getRecordNodeFromRecord<ObjectRecord>({
      record: cachedRecord,
      objectMetadataItem,
      objectMetadataItems,
      recordGqlFields: computedRecordGqlFields,
      computeReferences: false,
    });

    const computedOptimisticRecord = {
      ...cachedRecord,
      ...optimisticRecordInput,
      id: idToUpdate,
      __typename: getObjectTypename(objectMetadataItem.nameSingular),
    };
    const optimisticRecordWithConnection =
      getRecordNodeFromRecord<ObjectRecord>({
        record: computedOptimisticRecord,
        objectMetadataItem,
        objectMetadataItems,
        recordGqlFields: computedRecordGqlFields,
        computeReferences: false,
      });

    const shouldHandleOptimisticCache =
      !isNull(cachedRecord) &&
      isDefined(optimisticRecordWithConnection) &&
      isDefined(cachedRecordWithConnection);

    if (shouldHandleOptimisticCache) {
      const recordGqlFields = generateDepthOneRecordGqlFields({
        objectMetadataItem,
        record: optimisticRecordInput,
      });
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
        currentRecord: cachedRecordWithConnection,
        updatedRecord: optimisticRecordWithConnection,
        objectMetadataItems,
      });
    }

    const mutationResponseField =
      getUpdateOneRecordMutationResponseField(objectNameSingular);

    const sanitizedInput = {
      ...sanitizeRecordInput({
        objectMetadataItem,
        recordInput: updateOneRecordInput,
      }),
    };
    // Special case: If updating candidate's phoneNumber, also update person's phones
    if (objectNameSingular === 'candidate' && 'phoneNumber' in sanitizedInput && !isNull(cachedRecord)) {
      if (personObjectMetadataItem) {
        const phoneNumber = sanitizedInput.phoneNumber as PhoneNumberInput;
        const personUpdateInput = {
          phones: {
            primaryPhoneNumber: phoneNumber.primaryPhoneNumber,
            primaryPhoneCallingCode: phoneNumber.primaryPhoneCallingCode,
            primaryPhoneCountryCode: phoneNumber.primaryPhoneCountryCode,
          },
        };

        // Update person's phone number
        await apolloClient.mutate({
          mutation: updatePersonMutation,
          variables: {
            idToUpdate: cachedRecord.people?.id,
            input: personUpdateInput,
          },
        });

        // Update whitelist in Redis by calling the server endpoint
        try {
          const oldPhoneNumber = cachedRecord.phoneNumber?.primaryPhoneNumber;
          const newPhoneNumber = phoneNumber.primaryPhoneNumber;

          if (oldPhoneNumber !== newPhoneNumber) {
            const baseUrl = process.env.REACT_APP_SERVER_BASE_URL || 'http://localhost:3000';
            await fetch(`${baseUrl}/ext-sock-whatsapp/update-whitelist`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenPair?.accessToken?.token}`,
              },
              body: JSON.stringify({
                oldPhoneNumber: oldPhoneNumber,
                newPhoneNumber: newPhoneNumber,
                userId: currentWorkspaceMember?.id,
              }),
            });
          }
        } catch (error) {
          console.error('Failed to update whitelist:', error);
        }
      }
    }


    const updatedRecord = await apolloClient
      .mutate({
        mutation: updateOneRecordMutation,
        variables: {
          idToUpdate,
          input: sanitizedInput,
        },
        update: (cache, { data }) => {
          const record = data?.[mutationResponseField];
          if (!isDefined(record)) return;

          triggerUpdateRecordOptimisticEffect({
            cache,
            objectMetadataItem,
            currentRecord: computedOptimisticRecord,
            updatedRecord: record,
            objectMetadataItems,
          });
        },
      })
      .catch((error: Error) => {
        if (!shouldHandleOptimisticCache) {
          throw error;
        }
        const cachedRecordKeys = new Set(Object.keys(cachedRecord));
        const recordKeysAddedByOptimisticCache = Object.keys(
          optimisticRecordInput,
        ).filter((diffKey) => !cachedRecordKeys.has(diffKey));

        const recordGqlFields = {
          ...generateDepthOneRecordGqlFields({
            objectMetadataItem,
            record: cachedRecord,
          }),
          ...buildRecordFromKeysWithSameValue(
            recordKeysAddedByOptimisticCache,
            true,
          ),
        };

        updateRecordFromCache({
          objectMetadataItems,
          objectMetadataItem,
          cache: apolloClient.cache,
          record: {
            ...cachedRecord,
            ...buildRecordFromKeysWithSameValue(
              recordKeysAddedByOptimisticCache,
              null,
            ),
          },
          recordGqlFields,
        });

        triggerUpdateRecordOptimisticEffect({
          cache: apolloClient.cache,
          objectMetadataItem,
          currentRecord: optimisticRecordWithConnection,
          updatedRecord: cachedRecordWithConnection,
          objectMetadataItems,
        });

        throw error;
      });

    // Call sendUpdateJobToArxena if we're updating a job
    try {
      if (objectNameSingular === 'job' && 
          isDefined(updateOneRecordInput) && 
          isDefined(cachedRecord) && 
          isDefined(cachedRecord.arxenaSiteId)) {
        const jobName = (updateOneRecordInput.name as string) || cachedRecord.name;
        
        try {
          await sendUpdateJobToArxena(
            jobName,
            cachedRecord.arxenaSiteId as string,
            tokenPair?.accessToken?.token || '',
          );
        } catch (error) {
          console.log("Couldn't update job in arxena", error);
        }
      }
    } catch (error) {
      console.log('Error with Arxena job update operations', error);
    }

    await refetchAggregateQueries();
    return updatedRecord?.data?.[mutationResponseField] ?? null;
  };

  return {
    updateOneRecord,
  };
};
