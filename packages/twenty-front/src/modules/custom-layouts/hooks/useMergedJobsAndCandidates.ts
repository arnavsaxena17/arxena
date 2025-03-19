import { gql, useQuery } from '@apollo/client';
import { graphqlToFetchAllCandidateData } from 'twenty-shared';

export const useMergedJobsAndCandidates = () => {
  const { data, loading, error } = useQuery(
    gql(graphqlToFetchAllCandidateData),
  );

  // Transform the data to match the merged view structure
  const mergedData =
    data?.candidates?.edges?.map(({ node: candidate }: any) => ({
      id: `${candidate.id}`,
      jobName: candidate.jobs?.[0]?.name || '',
      jobLocation: candidate.jobs?.[0]?.jobLocation || '',
      candidateName: candidate.name,
      candidateStatus: candidate.candConversationStatus,
      __typename: 'MergedView',
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
    })) || [];

  return {
    data: mergedData,
    loading,
    error,
  };
};
