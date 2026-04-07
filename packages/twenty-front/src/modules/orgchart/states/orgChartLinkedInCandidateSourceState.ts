import { createState } from '@ui/utilities/state/utils/createState';

/** Backend `candidateSource`: LinkedIn via Unipile (default), Apify actor, or LinkedIn x-ray via Bright Data. */
export type OrgChartLinkedinCandidateSource =
  | 'unipile'
  | 'apify'
  | 'linkedin_xray';

export const orgChartLinkedinCandidateSourceState =
  createState<OrgChartLinkedinCandidateSource>({
    key: 'orgChartLinkedinCandidateSourceState',
    defaultValue: 'unipile',
  });
