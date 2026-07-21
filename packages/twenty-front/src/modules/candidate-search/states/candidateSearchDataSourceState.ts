import { createState } from 'twenty-ui';

/** Candidate search panel: LinkedIn (Unipile) vs Apollo.io proxy. */
export type CandidateSearchDataSource = 'linkedin' | 'apollo';

export const candidateSearchDataSourceState =
  createState<CandidateSearchDataSource>({
    key: 'candidateSearchDataSourceState',
    defaultValue: 'apollo',
  });
