import { styled } from '@linaria/react';
import { Link } from 'react-router-dom';
import { isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { useOutreachCommandDashboardPath } from '@/outreach-home/hooks/useOutreachCommandDashboardPath';
import { useOutreachProjectJourneySummary } from '@/outreach-home/hooks/useOutreachProjectJourneySummary';
import { type OutreachProjectJourneySummary } from '@/outreach-home/types/outreach-journey.types';

const StyledStrip = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  flex-wrap: wrap;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[3]};
`;

const StyledMetric = styled.span`
  white-space: nowrap;
`;

const StyledLink = styled(Link)`
  color: ${themeCssVariables.color.blue};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

type OutreachKpiStripProps = {
  projectId?: string | null;
  summary?: OutreachProjectJourneySummary | null;
  isLoading?: boolean;
};

export const OutreachKpiStrip = ({
  projectId,
  summary: summaryFromProps,
  isLoading: isLoadingFromProps,
}: OutreachKpiStripProps) => {
  const isControlled = summaryFromProps !== undefined;
  const { summary: fetchedSummary, isLoading: fetchedLoading } =
    useOutreachProjectJourneySummary(isControlled ? null : projectId);
  const dashboardPath = useOutreachCommandDashboardPath();

  const summary = isControlled ? summaryFromProps : fetchedSummary;
  const isLoading = isControlled
    ? (isLoadingFromProps ?? false)
    : fetchedLoading;

  if (isLoading || !summary) {
    return null;
  }

  const queued = summary.byStage.QUEUED ?? 0;
  const connectionSent = summary.byStage.CONNECTION_SENT ?? 0;
  const connectionAccepted = summary.byStage.CONNECTION_ACCEPTED ?? 0;
  const replied = summary.byStage.REPLIED ?? 0;
  const deferred = summary.byStage.DEFERRED ?? 0;

  return (
    <StyledStrip>
      <StyledMetric>{summary.totalEnrolled} enrolled</StyledMetric>
      <StyledMetric>{queued} queued</StyledMetric>
      <StyledMetric>{connectionSent} connection sent</StyledMetric>
      <StyledMetric>{connectionAccepted} accepted</StyledMetric>
      <StyledMetric>{replied} replied</StyledMetric>
      <StyledMetric>{deferred} deferred</StyledMetric>
      <StyledMetric>{summary.needsApproval} need approval</StyledMetric>
      <StyledMetric>{summary.dueThisWeek} due this week</StyledMetric>
      {isDefined(dashboardPath) ? (
        <StyledLink to={dashboardPath}>Open Outreach dashboard</StyledLink>
      ) : null}
    </StyledStrip>
  );
};
