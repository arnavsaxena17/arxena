import { styled } from '@linaria/react';
import axios from 'axios';
import { isNonEmptyString } from '@sniptt/guards';
import { useCallback, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { type OutreachAiColumnRunProgress } from '@/outreach-home/constants/outreach-cache-realtime.constants';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

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
    isFailed ? themeCssVariables.color.red : themeCssVariables.color.blue};
  height: 100%;
  transition: width 0.3s ease;
`;

const StyledCount = styled.span`
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;

const StyledStopButton = styled.button`
  background: transparent;
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  white-space: nowrap;

  &:hover:not(:disabled) {
    background: ${themeCssVariables.background.tertiary};
    color: ${themeCssVariables.font.color.primary};
  }

  &:disabled {
    cursor: default;
    opacity: 0.5;
  }
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
  projectId?: string | null;
};

export const OutreachAiColumnProgressBar = ({
  run,
  projectId,
}: OutreachAiColumnProgressBarProps) => {
  const tokenPair = useAtomStateValue(tokenPairState);
  const { enqueueErrorSnackBar } = useSnackBar();
  const [isStopping, setIsStopping] = useState(false);

  const canStop =
    isNonEmptyString(projectId) &&
    isDefined(run) &&
    (run.status === 'queued' || run.status === 'running');

  const handleStop = useCallback(async () => {
    if (!canStop || !isDefined(run) || !isNonEmptyString(projectId)) {
      return;
    }

    const token = tokenPair?.accessOrWorkspaceAgnosticToken?.token;

    if (!isNonEmptyString(token)) {
      enqueueErrorSnackBar({ message: 'Not signed in' });

      return;
    }

    setIsStopping(true);

    try {
      await axios.post(
        `${REACT_APP_SERVER_BASE_URL}/outreach-command/ai-column/cancel`,
        { projectId, runId: run.runId },
        { headers: { Authorization: `Bearer ${token}` } },
      );
    } catch (error) {
      const axiosMessage =
        axios.isAxiosError(error) &&
        typeof error.response?.data?.message === 'string'
          ? error.response.data.message
          : undefined;

      enqueueErrorSnackBar({
        message:
          axiosMessage ??
          (error instanceof Error
            ? error.message
            : 'Failed to stop AI column run'),
      });
    } finally {
      setIsStopping(false);
    }
  }, [
    canStop,
    enqueueErrorSnackBar,
    projectId,
    run,
    tokenPair?.accessOrWorkspaceAgnosticToken?.token,
  ]);

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
      {canStop ? (
        <StyledStopButton
          type="button"
          disabled={isStopping}
          onClick={() => {
            void handleStop();
          }}
        >
          {isStopping ? 'Stopping…' : 'Stop'}
        </StyledStopButton>
      ) : null}
    </StyledBar>
  );
};
