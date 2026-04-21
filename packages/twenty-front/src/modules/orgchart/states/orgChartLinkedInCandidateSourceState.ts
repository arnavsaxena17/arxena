import { createState } from '@ui/utilities/state/utils/createState';

/** Backend `candidateSource`: LinkedIn via Unipile (default), Apify, LinkedIn x-ray, or Apollo.io. */
export type OrgChartLinkedinCandidateSource =
  | 'unipile'
  | 'apify'
  | 'linkedin_xray'
  | 'apollo';

export const orgChartLinkedinCandidateSourceState =
  createState<OrgChartLinkedinCandidateSource>({
    key: 'orgChartLinkedinCandidateSourceState',
    defaultValue: 'unipile',
  });
