import { gql, useQuery } from '@apollo/client';
import { useEffect, useState } from 'react';

// Import the correct available states
import { Jobs, graphqlToFetchAllCandidateData, isDefined } from 'twenty-shared';
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
  //   const setRecordsInRecoil = useRecoilCallback(
  //     ({ set }) =>
  //       (recordIndexId: string, records: any[], recordIds: string[]) => {
  //         // The default group ID for records when not using groups
  //         const defaultGroupId = 'default';

  //         // Store the record IDs in the recordIndexRecordIdsByGroupComponentFamilyState
  //         // set(
  //         //   recordIndexRecordIdsByGroupComponentFamilyState(defaultGroupId),
  //         //   recordIds,
  //         // );

  //         // Store the record data in the global cache
  //         // Note: In Twenty's architecture, the record data itself might be stored
  //         // in a different location. For this example, we'll store it in the component's state
  //         // and let the table component fetch it from there.
  //       },
  //     [],
  //   );

  useEffect(() => {
    if (queryLoading) return;

    if (isDefined(queryError) && isError(queryError)) {
      console.error('Query error:', queryError);
      setError(queryError);
      setLoading(false);
      return;
    }

    console.log('Raw data from GraphQL:', JSON.stringify(data, null, 2));

    if (isDefined(data) && isDefined(data.candidates)) {
      try {
        console.log('Number of candidates:', data.candidates.edges.length);

        if (data.candidates.edges.length > 0) {
          console.log(
            'First candidate sample:',
            JSON.stringify(data.candidates.edges[0].node, null, 2),
          );
        }

        // Transform the data into a format compatible with the table
        const transformedData = data.candidates.edges.map((edge: any) => {
          const candidate = edge.node;

          // Handle cases where candidate might not have a job or has multiple jobs
          let job: Jobs = {} as Jobs;

          if (isDefined(candidate.jobs)) {
            // If jobs is an array, take the first one, otherwise use it directly
            job = Array.isArray(candidate.jobs)
              ? candidate.jobs.length > 0
                ? candidate.jobs[0]
                : {}
              : candidate.jobs;
          }

          // Get person data for emails/phones if available
          const person = candidate.people || {};
          const email = person.emails?.primaryEmail || '';
          const phone = person.phones?.primaryPhoneNumber || '';

          // Create a merged record with both candidate and job info
          return {
            id: `${candidate.id}`, // Generate a unique ID for the merged record
            candidateId: candidate.id,
            candidateName: candidate.name || '',
            candidateEmail: email,
            candidatePhone: phone,
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

        console.log(
          'Transformed data (first 2 items):',
          transformedData.length > 0
            ? JSON.stringify(transformedData.slice(0, 2), null, 2)
            : 'No data',
        );

        setMergedData(transformedData);

        // Set data in Recoil for the record table component
        // const recordIndexId = 'merged-unique-id-for-merged-view';
        //     setRecordsInRecoil(
        //     recordIndexId,
        //     transformedData,
        //     transformedData.map((record: any) => record.id),
        //     );
      } catch (err) {
        console.error('Error transforming data:', err);
        setError(
          err instanceof Error
            ? err
            : new Error('Unknown error processing data'),
        );
      } finally {
        setLoading(false);
      }
    } else {
      console.log('No candidates data found in GraphQL response');
      setLoading(false);
    }
  }, [data, queryLoading, queryError]);

  return { data: mergedData, loading, error };
};
