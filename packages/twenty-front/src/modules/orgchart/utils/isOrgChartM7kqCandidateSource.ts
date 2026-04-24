import { ORG_CHART_CANDIDATE_SOURCE_M7KQ } from '@/orgchart/constants/orgChartM7kqSource';

/**
 * True when an org chart response (or event) was produced by the m7kq directory
 * channel, including legacy cached payloads.
 */
export const isOrgChartM7kqCandidateSource = (
  s: string | null | undefined,
): boolean => s === ORG_CHART_CANDIDATE_SOURCE_M7KQ || s === 'apollo';
