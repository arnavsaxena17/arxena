import { useEffect } from 'react';
import { useRecoilValue } from 'recoil';

import { useSetRecordValue } from '@/object-record/record-store/contexts/RecordFieldValueSelectorContext';
import { recordStoreFamilyState } from '@/object-record/record-store/states/recordStoreFamilyState';
import { useQuery } from '@apollo/client';
import { GET_CANDIDATE_RECORD } from './GqlQueries';

// TODO: should be optimized and put higher up
export const RecordValueSetterEffect = ({ recordId, isConsolidated }: { recordId: string; isConsolidated?: boolean }) => {
  const setRecordValue = useSetRecordValue();

  let recordValue = useRecoilValue(recordStoreFamilyState(recordId));
  console.log('recordValue', recordValue);

  let entireCandidateObject;

  if (isConsolidated) {
    // fetch entire candidate record from database

    const { data, loading, error } = useQuery(GET_CANDIDATE_RECORD, {
      variables: {
        objectRecordId: recordId,
      },
    });
    entireCandidateObject = data;
  }

  useEffect(() => {
    setRecordValue(recordId, recordValue);
  }, [setRecordValue, recordValue, recordId]);

  return null;
};
