import { styled } from '@linaria/react';
import { isNonEmptyString } from '@sniptt/guards';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { type OutreachAiColumnRunProgress } from '@/outreach-home/constants/outreach-cache-realtime.constants';

const StyledBar = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.secondary};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  flex-shrink: 0;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledLabel = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-weight: ${themeCssVariables.font.weight.medium};
  white-space: nowrap;
`;

const StyledTrack = styled.div`
  background: ${themeCssVariables.background.tertiary};
  border-radius: ${themeCssVariables.border.radius.sm};
  flex: 1;
  height: 4px;
  min-width: 80px;
  overflow: hidden;
`;

const StyledFill = styled.div<{ isFailed: boolean }>`
  background: ${({ isFailed }) =>
    isFailed
      ? themeCssVariables.color.red
      : themeCssVariables.color.blue};
  height: 100%;
  transition: width 0.3s ease;
`;

const StyledCount = styled.span`
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;

const getStatusText = (run: OutreachAiColumnRunProgress): string => {
  switch (run.status) {
    case 'queued':
      return 'Queued';
    case 'running':
      return 'Running';
    case 'completed':
      return run.failed > 0 ? `Done, ${run.failed} failed` : 'Done';
    case 'cancelled':
      return 'Cancelled';
    case 'failed':
      return isNonEmptyString(run.error) ? `Stopped: ${run.error}` : 'Stopped';
  }
};

type OutreachAiColumnProgressBarProps = {
  run: OutreachAiColumnRunProgress | null | undefined;
};

export const OutreachAiColumnProgressBar = ({
  run,
}: OutreachAiColumnProgressBarProps) => {
  if (!run) {
    return null;
  }

  const percentage =
    run.total > 0 ? Math.min(100, Math.round((run.done / run.total) * 100)) : 0;

  return (
    <StyledBar role="status">
      <StyledLabel>AI column: {run.label}</StyledLabel>
      <StyledTrack>
        <StyledFill
          isFailed={run.status === 'failed'}
          style={{ width: `${percentage}%` }}
        />
      </StyledTrack>
      <StyledCount>
        {run.done}/{run.total}
      </StyledCount>
      <span title={run.error}>{getStatusText(run)}</span>
    </StyledBar>
  );
};
