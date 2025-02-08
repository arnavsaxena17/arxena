import { useRecoilCallback } from 'recoil';
import { recordStoreFamilyState } from '@/object-record/record-store/states/recordStoreFamilyState';
import { v4 } from 'uuid';
import { useCreateOneRecord } from './useCreateOneRecord';
import { RecordGqlOperationGqlRecordFields } from '@/object-record/graphql/types/RecordGqlOperationGqlRecordFields';

type UseCloneMultipleRecordsProps = {
  objectNameSingular: string;
  recordGqlFields?: RecordGqlOperationGqlRecordFields;
  skipPostOptmisticEffect?: boolean;
};


export const useCloneMultipleRecords = ({
  objectNameSingular,
  recordGqlFields,
  skipPostOptmisticEffect = false,
}: UseCloneMultipleRecordsProps) => {
  const { createOneRecord } = useCreateOneRecord({
    objectNameSingular,
    recordGqlFields,
    skipPostOptmisticEffect,
  });

  const cloneMultipleRecords = useRecoilCallback(
    ({ snapshot }) =>
      async (recordIds: string[]) => {
        const clonedRecords = [];
        
        for (const recordId of recordIds) {
          try {
            const recordToClone = snapshot.getLoadable(recordStoreFamilyState(recordId)).getValue();
            
            if (recordToClone) {
              const {
                id,
                createdAt,
                updatedAt,
                __typename,
                favorites,
                ...cloneableData
              } = recordToClone;

              const clonedRecord = await createOneRecord({
                ...cloneableData,
                id: v4(),
              });
              
              if (clonedRecord) {
                clonedRecords.push(clonedRecord);
              }
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (err) {
            console.error(`Failed to clone record ${recordId}:`, err);
          }
        }
        
        return clonedRecords;
      },
    [createOneRecord]
  );

  return {
    cloneMultipleRecords,
  };
};