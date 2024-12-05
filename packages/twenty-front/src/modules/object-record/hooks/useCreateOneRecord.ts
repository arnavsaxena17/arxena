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
import { useUpdateOneRecord } from './useUpdateOneRecord';
import mongoose from 'mongoose';




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
  
  const { objectMetadataItems } = useObjectMetadataItems();

  const jobMetadataItem = objectMetadataItems.find(item => item.nameSingular === 'job');

  const updateOneRecordHook = jobMetadataItem ? useUpdateOneRecord({
    objectNameSingular: 'job',
  }) : null;

  const updateOneRecord = updateOneRecordHook ? updateOneRecordHook.updateOneRecord : null;

  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular,
  });
  const sendJobToArxena = async (jobName: string, arxenaJobId:string) => {
    console.log("process.env.NODE_ENV", process.env.NODE_ENV);
    try {
      console.log("This is the jobName", jobName);
      // const arxenaJobId = v4();
      const response = await axios.post(
        process.env.NODE_ENV === 'production' ? 'https://app.arxena.com/app/candidate-sourcing/create-job-in-arxena' : 'http://localhost:3000/candidate-sourcing/create-job-in-arxena',
        { job_name: jobName,new_job_id:arxenaJobId },
        { headers: { 'Authorization': `Bearer ${tokenPair?.accessToken?.token}`, 'Content-Type': 'application/json', }, }
      );
      console.log("Received this response:", response.data);


      if (response.status !== 200 && response.status !== 201) {
        throw new Error(`Failed to create job on Arxena: ${response.statusText}`);
      }
      else{
        console.log("Job sent to Arxena successfully")
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

    try{
      console.log("This si th einput", input);
      if (objectNameSingular === 'job' && input?.name) {
        try {
          const idToUpdate = input.id || ''; 
          const arxenaJobId = new mongoose.Types.ObjectId().toString(); 
          
          if (updateOneRecord) { // Add this null check
            await updateOneRecord({
              idToUpdate: idToUpdate,
              updateOneRecordInput: { "arxenaSiteId": arxenaJobId },
            });
            await sendJobToArxena(input?.name, arxenaJobId);
          } else {
            console.log("updateOneRecord is not available");
            // Handle the case where updateOneRecord is null
          }
        } catch (error) {
          console.log("Couldn't send job to arxena with error", error);
        }      }
    }
    catch (error) {
      console.log("Error sending job to Arxena", error);
      
      return null;
    }

    return createdObject.data?.[mutationResponseField] ?? null;
  };

  return {
    createOneRecord,
    loading,
  };
};
