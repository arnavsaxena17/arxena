import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { isDefined } from 'twenty-shared/utils';
import { StepStatus, type WorkflowRunStepInfo } from 'twenty-shared/workflow';
import {
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconInfoCircle,
  IconPlayerPause,
  IconPlayerSkipForward,
} from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import {
  StyledErrorCard,
  StyledErrorMessageText,
  StyledHeaderLeft,
  StyledSection,
  StyledSectionTitle,
  StyledStatusBadge,
  StyledSummaryCard,
  StyledSummaryHeader,
  StyledTitle,
} from '@/workflow/workflow-run/observability/workflowRunStepLogsStyles';

const StyledHint = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.4;
`;

const TERMINAL_STATUSES = new Set<StepStatus>([
  StepStatus.SUCCESS,
  StepStatus.FAILED,
  StepStatus.FAILED_SAFELY,
  StepStatus.STOPPED,
  StepStatus.SKIPPED,
  StepStatus.PENDING,
]);

const isSuccessStatus = (status: StepStatus): boolean =>
  status === StepStatus.SUCCESS || status === StepStatus.SKIPPED;

const getStatusIcon = (status: StepStatus) => {
  switch (status) {
    case StepStatus.SUCCESS:
      return IconCheck;
    case StepStatus.SKIPPED:
      return IconPlayerSkipForward;
    case StepStatus.PENDING:
      return IconPlayerPause;
    case StepStatus.STOPPED:
      return IconClock;
    default:
      return IconAlertTriangle;
  }
};

const formatStatusLabel = (status: StepStatus): string =>
  status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatErrorMessage = (error: unknown): string | undefined => {
  if (typeof error === 'string' && error.length > 0) {
    return error;
  }

  if (isDefined(error) && typeof error === 'object') {
    if (
      'message' in error &&
      typeof (error as { message?: unknown }).message === 'string'
    ) {
      return (error as { message: string }).message;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return undefined;
};

export const canShowWorkflowRunStepLogsStatusFallback = (
  stepInfo: WorkflowRunStepInfo | undefined,
): stepInfo is WorkflowRunStepInfo =>
  isDefined(stepInfo) && TERMINAL_STATUSES.has(stepInfo.status);

export const WorkflowRunStepLogsStatusFallback = ({
  stepInfo,
}: {
  stepInfo: WorkflowRunStepInfo;
}) => {
  const { t } = useLingui();
  const isSuccess = isSuccessStatus(stepInfo.status);
  const StatusIcon = getStatusIcon(stepInfo.status);
  const errorMessage = formatErrorMessage(stepInfo.error);

  return (
    <>
      <StyledSummaryCard>
        <StyledSummaryHeader>
          <StyledHeaderLeft>
            <IconInfoCircle size={16} />
            <StyledTitle>{t`Step status`}</StyledTitle>
          </StyledHeaderLeft>
          <StyledStatusBadge isSuccess={isSuccess}>
            <StatusIcon size={12} />
            {formatStatusLabel(stepInfo.status)}
          </StyledStatusBadge>
        </StyledSummaryHeader>
        <StyledHint>
          {t`No detailed logs were recorded for this step. Showing the run status instead.`}
        </StyledHint>
      </StyledSummaryCard>

      {isDefined(errorMessage) && (
        <StyledSection>
          <StyledSectionTitle>{t`Error`}</StyledSectionTitle>
          <StyledErrorCard>
            <StyledErrorMessageText>{errorMessage}</StyledErrorMessageText>
          </StyledErrorCard>
        </StyledSection>
      )}
    </>
  );
};
