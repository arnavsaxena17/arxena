import { useState } from 'react';
import { useApolloClient } from '@apollo/client';
import { v4 } from 'uuid';

import { triggerCreateRecordsOptimisticEffect } from '@/apollo/optimistic-effect/utils/triggerCreateRecordsOptimisticEffect';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { useCreateOneRecordInCache } from '@/object-record/cache/hooks/useCreateOneRecordInCache';
import { getObjectTypename } from '@/object-record/cache/utils/getObjectTypename';
import { RecordGqlOperationGqlRecordFields } from '@/object-record/graphql/types/RecordGqlOperationGqlRecordFields';
import { generateDepthOneRecordGqlFields } from '@/object-record/graphql/utils/generateDepthOneRecordGqlFields';
import { useCreateOneRecordMutation } from '@/object-record/hooks/useCreateOneRecordMutation';
import { ObjectRecord } from '@/object-record/types/ObjectRecord';
import { getCreateOneRecordMutationResponseField } from '@/object-record/utils/getCreateOneRecordMutationResponseField';
import { sanitizeRecordInput } from '@/object-record/utils/sanitizeRecordInput';
import { isDefined } from '~/utils/isDefined';
import axios from 'axios';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useRecoilValue, useRecoilState } from 'recoil';


type useCreateOneRecordProps = {
  objectNameSingular: string;
  recordGqlFields?: RecordGqlOperationGqlRecordFields;
  skipPostOptmisticEffect?: boolean;
};

export const useCreateOneRecord = <
  CreatedObjectRecord extends ObjectRecord = ObjectRecord,
>({
  objectNameSingular,
  recordGqlFields,
  skipPostOptmisticEffect = false,
}: useCreateOneRecordProps) => {
  const apolloClient = useApolloClient();
  const [loading, setLoading] = useState(false);
  const [jobApiError, setJobApiError] = useState<string | null>(null);
  const [tokenPair] = useRecoilState(tokenPairState);

  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular,
  });
  const sendJobToArxena = async (jobName: string) => {
    console.log("process.env.NODE_ENV", process.env.NODE_ENV);
    try {
      console.log("This is the jobName", jobName);
      const response = await axios.post(
        process.env.NODE_ENV === 'production'
          ? 'https://app.arxena.com/app/candidate-sourcing/create-job-in-arxena'
          : 'http://localhost:3000/candidate-sourcing/create-job-in-arxena',
        {
          job_name: jobName,
        },
        {
          headers: {
          'Authorization': `Bearer ${tokenPair?.accessToken?.token}`,
          'Content-Type': 'application/json',
          },
        }
      );

      if (response.status !== 200) {
        throw new Error(`Failed to create job on Arxena: ${response.statusText}`);
      }
      return response.data;
    } catch (error) {
      setJobApiError(error instanceof Error ? error.message : 'Failed to create job on Arxena');
      throw error;
    }
  };


  const computedRecordGqlFields =
    recordGqlFields ?? generateDepthOneRecordGqlFields({ objectMetadataItem });

  const { createOneRecordMutation } = useCreateOneRecordMutation({
    objectNameSingular,
    recordGqlFields: computedRecordGqlFields,
  });

  const createOneRecordInCache = useCreateOneRecordInCache<CreatedObjectRecord>(
    {
      objectMetadataItem,
    },
  );

  const { objectMetadataItems } = useObjectMetadataItems();

  const createOneRecord = async (input: Partial<CreatedObjectRecord>) => {
    setLoading(true);
    setJobApiError(null);


    const idForCreation = input.id ?? v4();

    const sanitizedInput = {
      ...sanitizeRecordInput({
        objectMetadataItem,
        recordInput: input,
      }),
      id: idForCreation,
    };

    const recordCreatedInCache = createOneRecordInCache({
      ...input,
      id: idForCreation,
      __typename: getObjectTypename(objectMetadataItem.nameSingular),
    });

    if (isDefined(recordCreatedInCache)) {
      triggerCreateRecordsOptimisticEffect({
        cache: apolloClient.cache,
        objectMetadataItem,
        recordsToCreate: [recordCreatedInCache],
        objectMetadataItems,
      });
    }

    try{
      console.log("This si th einput", input);
      if (objectNameSingular === 'job' && input.name) {
        await sendJobToArxena(input.name as string);
      }
    }
    catch (error) {
      console.log("Error sending job to Arxena", error);
      return null;
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

        if (!record || skipPostOptmisticEffect) return;

        triggerCreateRecordsOptimisticEffect({
          cache,
          objectMetadataItem,
          recordsToCreate: [record],
          objectMetadataItems,
        });
        setLoading(false);
      },
    });

    return createdObject.data?.[mutationResponseField] ?? null;
  };

  return {
    createOneRecord,
    loading,
  };
};
