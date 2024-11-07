import { useState, useEffect } from 'react';
import { v4 } from 'uuid';

import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { useFindOneRecord } from '@/object-record/hooks/useFindOneRecord';
import { ObjectRecord } from '@/object-record/types/ObjectRecord';
import { RecordGqlOperationGqlRecordFields } from '@/object-record/graphql/types/RecordGqlOperationGqlRecordFields';

type UseCloneOneRecordProps = {
  objectNameSingular: string;
  recordIdToClone?: string;
  recordGqlFields?: RecordGqlOperationGqlRecordFields;
  skipPostOptmisticEffect?: boolean;
};

export const useCloneOneRecord = <
  ClonedObjectRecord extends ObjectRecord = ObjectRecord,
>({
  objectNameSingular,
  recordIdToClone,
  recordGqlFields,
  skipPostOptmisticEffect = false,
}: UseCloneOneRecordProps) => {
  // console.log("going to try toi clone record recordIdToClone:", recordIdToClone )
  // console.log("going to try toi clone record: objectNameSingular", objectNameSingular )
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isReady, setIsReady] = useState(false);

  const [recordData, setRecordData] = useState<ClonedObjectRecord | null>(null);

  const { objectMetadataItem } = useObjectMetadataItem({
    objectNameSingular,
  });

  const { createOneRecord } = useCreateOneRecord<ClonedObjectRecord>({
    objectNameSingular,
    recordGqlFields,
    skipPostOptmisticEffect,
  });

  const { record: recordToClone, loading: fetchingRecord } = useFindOneRecord<ClonedObjectRecord>({
    objectNameSingular,
    objectRecordId: recordIdToClone || '',
    recordGqlFields,
    skip: !recordIdToClone,
  });


  useEffect(() => {
    if (recordToClone && !fetchingRecord) {
      setIsReady(true);
    } else {
      setIsReady(false);
    }
  }, [recordToClone, fetchingRecord]);

  // console.log("recordToClone in hook:", recordToClone )

  const cloneRecord = async () => { // Removed recordId parameter since we use recordIdToClone from props
    // console.log("going to clone record")
    if (!isReady || !recordToClone) {
      console.log("Waiting for record data to be ready...");
      // Wait for a short period and check again
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (!recordToClone) {
        setError(new Error('No record to clone - data not available'));
        return null;
      }
    }


    try {
      // console.log("Going to try and set cloning")
      setCloning(true);
      setError(null);
      // console.log("recordToClone:", recordToClone)
      // Create a new record object without specific fields that shouldn't be cloned
      const {
        id,
        createdAt,
        updatedAt,
        __typename,
        favorites,
        ...cloneableData
      } = recordToClone;

      // console.log("cloneableData:", cloneableData)
      // Create the cloned record with a new ID
      const clonedRecord = await createOneRecord({
        ...cloneableData,
        id: v4(), // Generate a new UUID for the cloned record
      } as Partial<ClonedObjectRecord>);

      // console.log("cloned record is", clonedRecord)
      return clonedRecord;
    } catch (err) {
      console.log("error in cloning record:", err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to clone record';
      setError(new Error(errorMessage));
      return null;
    } finally {
      // console.log("finally in cloning record")
      setCloning(false);
    }
  };

  return {
    cloneRecord,
    loading: fetchingRecord || cloning,
    error,
    recordToClone,
    isReady,
  };
};