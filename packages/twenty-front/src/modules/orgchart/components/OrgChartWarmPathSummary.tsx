import { useWarmPathResolve } from '@/candidate-table/hooks/useWarmPathResolve';
import styled from '@emotion/styled';
import { useEffect } from 'react';

const StyledWarmPathMeta = styled.div`
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.sm};
  line-height: ${({ theme }) => theme.text.lineHeight.md};
`;

type OrgChartWarmPathSummaryProps = {
  linkedinUrl?: string;
};

export const OrgChartWarmPathSummary = ({
  linkedinUrl,
}: OrgChartWarmPathSummaryProps) => {
  const { data, isLoading, error, hasLinkedinUrl, resolve } =
    useWarmPathResolve({ linkedinUrl });

  useEffect(() => {
    if (
      hasLinkedinUrl === true &&
      data === null &&
      isLoading === false &&
      error === null
    ) {
      void resolve();
    }
  }, [hasLinkedinUrl, data, isLoading, error, resolve]);

  if (hasLinkedinUrl !== true) {
    return null;
  }

  if (isLoading === true && data === null) {
    return (
      <StyledWarmPathMeta data-testid="orgchart-warm-path-loading">
        Finding warm paths…
      </StyledWarmPathMeta>
    );
  }

  if (error !== null && data === null) {
    return (
      <StyledWarmPathMeta data-testid="orgchart-warm-path-empty">
        No warm path
      </StyledWarmPathMeta>
    );
  }

  if (data === null) {
    return null;
  }

  const mutualCount = data.honesty.directMutualCount;
  const routeLabel = data.bestRouteLabel ?? 'No route found in your network';
  const mutualsLabel = `${mutualCount} mutual${mutualCount === 1 ? '' : 's'}`;

  return (
    <StyledWarmPathMeta data-testid="orgchart-warm-path-summary">
      {routeLabel} · {mutualsLabel}
    </StyledWarmPathMeta>
  );
};
