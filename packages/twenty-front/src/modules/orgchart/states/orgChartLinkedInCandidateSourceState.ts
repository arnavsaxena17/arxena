import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

import { ORG_CHART_CANDIDATE_SOURCE_M7KQ } from '@/orgchart/constants/orgChartM7kqSource';

/** Backend `candidateSource` (m7kq slug) plus LinkedIn via Unipile, Apify, or x-ray. */
export type OrgChartLinkedinCandidateSource =
  | 'unipile'
  | 'apify'
  | 'harvest'
  | 'linkedin_xray'
  | typeof ORG_CHART_CANDIDATE_SOURCE_M7KQ;

export const orgChartLinkedinCandidateSourceState =
  createAtomState<OrgChartLinkedinCandidateSource>({
    key: 'orgChartLinkedinCandidateSourceState',
    defaultValue: 'unipile',
  });
