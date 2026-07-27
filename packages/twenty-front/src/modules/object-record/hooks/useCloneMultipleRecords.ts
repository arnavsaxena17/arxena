import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { recordStoreFamilyState } from '@/object-record/record-store/states/recordStoreFamilyState';
import { type RecordGqlOperationGqlRecordFields } from 'twenty-shared/types';
import { useStore } from 'jotai';
import { useCallback } from 'react';
import { v4 } from 'uuid';

type UseCloneMultipleRecordsParams = {
  objectNameSingular: string;
  recordGqlFields?: RecordGqlOperationGqlRecordFields;
  skipPostOptimisticEffect?: boolean;
};

export const useCloneMultipleRecords = ({
  objectNameSingular,
  recordGqlFields,
  skipPostOptimisticEffect = false,
}: UseCloneMultipleRecordsParams) => {
  const store = useStore();

  const { createOneRecord } = useCreateOneRecord({
    objectNameSingular,
    recordGqlFields,
    skipPostOptimisticEffect,
  });

  const cloneMultipleRecords = useCallback(
    async (recordIds: string[]) => {
      const clonedRecords = [];

      for (const recordId of recordIds) {
        try {
          const recordToClone = store.get(
            recordStoreFamilyState.atomFamily(recordId),
          );

          if (recordToClone) {
            const {
              id: _id,
              createdAt: _createdAt,
              updatedAt: _updatedAt,
              __typename: _typename,
              favorites: _favorites,
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

          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Failed to clone record ${recordId}:`, error);
        }
      }

      return clonedRecords;
    },
    [createOneRecord, store],
  );

  return {
    cloneMultipleRecords,
  };
};
