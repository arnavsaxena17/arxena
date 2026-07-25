import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

/** Candidate search panel: LinkedIn (Unipile) vs Apollo.io proxy. */
export type CandidateSearchDataSource = 'linkedin' | 'apollo';

export const candidateSearchDataSourceState =
  createAtomState<CandidateSearchDataSource>({
    key: 'candidateSearchDataSourceState',
    defaultValue: 'apollo',
  });
