import { gql, useQuery } from '@apollo/client';
import { useEffect, useState } from 'react';
import { useRecoilCallback } from 'recoil';

// Import the correct available states
import { recordIndexRecordIdsByGroupComponentFamilyState } from '@/object-record/record-index/states/recordIndexRecordIdsByGroupComponentFamilyState';
import { graphqlToFetchAllCandidateData, isDefined } from 'twenty-shared';
import { isError } from 'util';

// Define the GraphQL query to fetch merged data

export const useMergedJobsAndCandidates = () => {
  const [mergedData, setMergedData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const {
    data,
    loading: queryLoading,
    error: queryError,
  } = useQuery(gql(graphqlToFetchAllCandidateData));

  // Create a setter for Recoil state that will be used by the record table
  const setRecordsInRecoil = useRecoilCallback(
    ({ set }) =>
      (recordIndexId: string, records: any[], recordIds: string[]) => {
        // The default group ID for records when not using groups
        const defaultGroupId = 'default';

        // Store the record IDs in the recordIndexRecordIdsByGroupComponentFamilyState
        set(
          recordIndexRecordIdsByGroupComponentFamilyState(defaultGroupId),
          recordIds,
        );

        // Store the record data in the global cache
        // Note: In Twenty's architecture, the record data itself might be stored
        // in a different location. For this example, we'll store it in the component's state
        // and let the table component fetch it from there.
      },
    [],
  );

  useEffect(() => {
    if (queryLoading) return;

    if (isDefined(queryError) && isError(queryError)) {
      setError(queryError);
      setLoading(false);
      return;
    }

    if (isDefined(data) && isDefined(data.candidates)) {
      try {
        // Transform the data into a format compatible with the table
        const transformedData = data.candidates.edges.map((edge: any) => {
          const candidate = edge.node;
          const job = candidate.jobs || {};

          // Create a merged record with both candidate and job info
          return {
            id: `${candidate.id}-${job.id || 'nojob'}`, // Generate a unique ID for the merged record
            candidateId: candidate.id,
            candidateName: candidate.name,
            candidateEmail: candidate.email?.primaryEmail || '',
            candidatePhone: candidate.phoneNumber?.primaryPhoneNumber || '',
            candidateStatus: candidate.engagementStatus
              ? 'Engaged'
              : 'Not Engaged',
            chatCount: candidate.chatCount || 0,
            jobId: job.id || '',
            jobName: job.name || '',
            jobLocation: job.jobLocation || '',
            jobCode: job.jobCode || '',
            jobActive: job.isActive ? 'Active' : 'Inactive',
            companyName: job.company?.name || '',
          };
        });

        setMergedData(transformedData);

        // Set data in Recoil for the record table component
        const recordIndexId = 'merged-unique-id-for-merged-view';
        setRecordsInRecoil(
          recordIndexId,
          transformedData,
          transformedData.map((record: any) => record.id),
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err
            : new Error('Unknown error processing data'),
        );
      } finally {
        setLoading(false);
      }
    }
  }, [data, queryLoading, queryError, setRecordsInRecoil]);

  return { data: mergedData, loading, error };
};
