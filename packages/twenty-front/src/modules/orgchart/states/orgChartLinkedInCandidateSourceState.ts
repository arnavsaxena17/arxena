import { createState } from '@ui/utilities/state/utils/createState';

/** Backend `candidateSource`: Apollo.io (default), LinkedIn via Unipile, Apify, or LinkedIn x-ray. */
export type OrgChartLinkedinCandidateSource =
  | 'unipile'
  | 'apify'
  | 'linkedin_xray'
  | 'apollo';

export const orgChartLinkedinCandidateSourceState =
  createState<OrgChartLinkedinCandidateSource>({
    key: 'orgChartLinkedinCandidateSourceState',
    defaultValue: 'apollo',
  });
