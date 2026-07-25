import { useMemo } from 'react';

import { ORG_CHART_CANDIDATE_SOURCE_M7KQ } from '@/orgchart/constants/orgChartM7kqSource';
import { isOrgChartM7kqCandidateSource } from '@/orgchart/utils/isOrgChartM7kqCandidateSource';

import type { OrgChartNodeData } from 'twenty-shared/utils';

export const useOrgChartBanners = ({
  nodeDataArray,
  isLoading,
  error,
  isBlankTemplate,
  orgSource,
  effectiveEmployeeCount,
  orgChartLinkedinCandidateSource,
  leadershipLayerPreviewBanner,
}: {
  nodeDataArray: OrgChartNodeData[];
  isLoading: boolean;
  error: string | null;
  isBlankTemplate: boolean;
  orgSource: Record<string, unknown> | null;
  effectiveEmployeeCount: number | null | undefined;
  orgChartLinkedinCandidateSource: string;
  leadershipLayerPreviewBanner: { leadershipN: number; fullN: number | null } | null;
}) => {
  const hasPreviewOrgChartNodes = useMemo(
    () => nodeDataArray.some((n) => n.nodeState === 'preview'),
    [nodeDataArray],
  );

  const showPreviewPersistentBanner =
    hasPreviewOrgChartNodes && !isLoading && !error && nodeDataArray.length > 0;

  const fetchedPeopleInNodeArray = useMemo(() => {
    let count = 0;
    for (const node of nodeDataArray) {
      const total = (node as Record<string, unknown>).total_people;
      if (typeof total === 'number' && total >= 0) {
        count += total;
        continue;
      }
      for (let i = 0; i < 8; i += 1) {
        const name = (node as Record<string, unknown>)[`name_${i}`];
        if (typeof name === 'string' && name.trim().length > 0) {
          count += 1;
        }
      }
    }
    return count;
  }, [nodeDataArray]);

  const m7kqPreviewOrgChartBanner = useMemo(() => {
    if (leadershipLayerPreviewBanner !== null) {
      return null;
    }
    if (isLoading || !!error || isBlankTemplate || nodeDataArray.length === 0) {
      return null;
    }
    const candidateSourceFromChart =
      typeof orgSource?.candidateSource === 'string'
        ? (orgSource.candidateSource as string)
        : null;
    if (!isOrgChartM7kqCandidateSource(candidateSourceFromChart)) {
      return null;
    }
    const hasRealLoadedNode = nodeDataArray.some((n) => n.nodeState !== 'preview');
    if (!hasRealLoadedNode) {
      return null;
    }
    const itemCountFromChart =
      typeof orgSource?.itemCount === 'number' ? (orgSource.itemCount as number) : null;
    const fetchedN =
      itemCountFromChart !== null && itemCountFromChart > 0
        ? itemCountFromChart
        : fetchedPeopleInNodeArray;
    if (fetchedN <= 0) {
      return null;
    }
    const fullN =
      typeof effectiveEmployeeCount === 'number' ? effectiveEmployeeCount : null;
    return { fetchedN, fullN };
  }, [
    leadershipLayerPreviewBanner,
    orgSource,
    isLoading,
    error,
    isBlankTemplate,
    nodeDataArray,
    fetchedPeopleInNodeArray,
    effectiveEmployeeCount,
  ]);

  const isM7kqOrgChartSource = useMemo(() => {
    const candidateSourceFromChart =
      typeof orgSource?.candidateSource === 'string'
        ? (orgSource.candidateSource as string)
        : null;
    return (
      isOrgChartM7kqCandidateSource(candidateSourceFromChart) ||
      (candidateSourceFromChart === null &&
        orgChartLinkedinCandidateSource === ORG_CHART_CANDIDATE_SOURCE_M7KQ)
    );
  }, [orgSource, orgChartLinkedinCandidateSource]);

  return {
    showPreviewPersistentBanner,
    m7kqPreviewOrgChartBanner,
    isM7kqOrgChartSource,
  };
};

