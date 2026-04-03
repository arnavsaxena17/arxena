
import { createState } from '@ui/utilities/state/utils/createState';

/** Backend `candidateSource`: LinkedIn via Unipile (default) vs Apify actor. */
export type OrgChartLinkedinCandidateSource = 'unipile' | 'apify';

export const orgChartLinkedinCandidateSourceState =
  createState<OrgChartLinkedinCandidateSource>({
    key: 'orgChartLinkedinCandidateSourceState',
    defaultValue: 'unipile',
  });
