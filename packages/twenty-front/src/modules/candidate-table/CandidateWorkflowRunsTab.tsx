import { styled } from '@linaria/react';
import { useMemo, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { Loader } from 'twenty-ui/feedback';
import { type SelectOption } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { OutreachWorkflowRunDiagramEmbed } from '@/outreach-home/components/OutreachWorkflowRunDiagramEmbed';
import { type CandidateOutreachJourneyActiveRun } from '@/outreach-home/types/outreach-journey.types';
import { resolveOutreachPendingStepLabel } from '@/outreach-home/utils/resolveOutreachJourneyLabels';
import { Select } from '@/ui/input/components/Select';

const StyledContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  height: 100%;
  min-height: 0;
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledHeader = styled.div`
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledSectionTitle = styled.h3`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin: 0;
`;

const StyledMuted = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  margin: 0;
`;

const StyledFailureBanner = styled.div`
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  color: ${themeCssVariables.font.color.primary};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledCanvas = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  flex: 1;
  min-height: 420px;
  overflow: hidden;

  > * {
    height: 100%;
  }
`;

const formatWorkflowRunOptionLabel = (
  run: CandidateOutreachJourneyActiveRun,
): string => {
  const statusLabel =
    run.status === 'FAILED'
      ? 'Failed'
      : run.status === 'RUNNING'
        ? 'Running'
        : run.status === 'ENQUEUED'
          ? 'Queued'
          : run.status === 'NOT_STARTED'
            ? 'Not started'
            : run.status;

  return `${run.workflowName} · ${statusLabel}`;
};

type CandidateWorkflowRunsTabProps = {
  activeRuns: CandidateOutreachJourneyActiveRun[];
  failedRuns?: CandidateOutreachJourneyActiveRun[];
  lastFailedRun?: CandidateOutreachJourneyActiveRun | null;
  isLoading: boolean;
};

export const CandidateWorkflowRunsTab = ({
  activeRuns,
  failedRuns = [],
  lastFailedRun = null,
  isLoading,
}: CandidateWorkflowRunsTabProps) => {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const selectableRuns = useMemo(() => {
    const failedRunIds = new Set(
      failedRuns.map((run) => run.workflowRunId),
    );
    const legacyFailedRuns =
      isDefined(lastFailedRun) &&
      !failedRunIds.has(lastFailedRun.workflowRunId)
        ? [lastFailedRun]
        : [];

    return [...activeRuns, ...failedRuns, ...legacyFailedRuns];
  }, [activeRuns, failedRuns, lastFailedRun]);

  const selectedRun =
    selectableRuns.find((run) => run.workflowRunId === selectedRunId) ??
    selectableRuns[0] ??
    null;

  const runOptions: SelectOption<string>[] = selectableRuns.map((run) => ({
    label: formatWorkflowRunOptionLabel(run),
    value: run.workflowRunId,
  }));

  if (isLoading && selectableRuns.length === 0) {
    return (
      <StyledContainer>
        <Loader />
      </StyledContainer>
    );
  }

  if (selectableRuns.length === 0 || !isDefined(selectedRun)) {
    return (
      <StyledContainer>
        <StyledMuted>
          No active or failed workflow runs for this candidate.
        </StyledMuted>
      </StyledContainer>
    );
  }

  const isFailedRun = selectedRun.status === 'FAILED';
  const failureLabel = isFailedRun
    ? resolveOutreachPendingStepLabel({
        currentStepName: selectedRun.currentStepName,
        currentStepKind: selectedRun.currentStepKind,
        pendingReason: selectedRun.pendingReason,
        errorMessage: selectedRun.errorMessage,
        status: selectedRun.status,
      })
    : null;

  return (
    <StyledContainer>
      <StyledHeader>
        <StyledSectionTitle>
          Workflow runs ({selectableRuns.length})
        </StyledSectionTitle>
        {selectableRuns.length > 1 ? (
          <Select<string>
            dropdownId="candidate-workflow-runs-select"
            label="Workflow run"
            value={selectedRun.workflowRunId}
            onChange={setSelectedRunId}
            options={runOptions}
            fullWidth
            selectSizeVariant="small"
            needIconCheck={false}
            withSearchInput={selectableRuns.length > 5}
          />
        ) : (
          <StyledMuted>
            {formatWorkflowRunOptionLabel(selectedRun)}
          </StyledMuted>
        )}
      </StyledHeader>
      {isFailedRun ? (
        <StyledFailureBanner>
          <StyledSectionTitle>Failed run</StyledSectionTitle>
          <StyledMuted>{selectedRun.workflowName}</StyledMuted>
          {isDefined(failureLabel) ? <strong>{failureLabel}</strong> : null}
          {isDefined(selectedRun.errorMessage) ? (
            <StyledMuted>{selectedRun.errorMessage}</StyledMuted>
          ) : null}
        </StyledFailureBanner>
      ) : null}
      <StyledCanvas>
        <OutreachWorkflowRunDiagramEmbed
          key={selectedRun.workflowRunId}
          workflowRunId={selectedRun.workflowRunId}
        />
      </StyledCanvas>
    </StyledContainer>
  );
};
