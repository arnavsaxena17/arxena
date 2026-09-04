import { styled } from '@linaria/react';
import { useState } from 'react';
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

type CandidateWorkflowRunsTabProps = {
  activeRuns: CandidateOutreachJourneyActiveRun[];
  lastFailedRun?: CandidateOutreachJourneyActiveRun | null;
  isLoading: boolean;
};

export const CandidateWorkflowRunsTab = ({
  activeRuns,
  lastFailedRun = null,
  isLoading,
}: CandidateWorkflowRunsTabProps) => {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const selectedRun =
    activeRuns.find((run) => run.workflowRunId === selectedRunId) ??
    activeRuns[0] ??
    null;

  const runOptions: SelectOption<string>[] = activeRuns.map((run) => ({
    label: run.workflowName,
    value: run.workflowRunId,
  }));

  if (isLoading && activeRuns.length === 0 && !isDefined(lastFailedRun)) {
    return (
      <StyledContainer>
        <Loader />
      </StyledContainer>
    );
  }

  if (activeRuns.length === 0 || !isDefined(selectedRun)) {
    if (isDefined(lastFailedRun)) {
      const failureLabel = resolveOutreachPendingStepLabel({
        currentStepName: lastFailedRun.currentStepName,
        currentStepKind: lastFailedRun.currentStepKind,
        pendingReason: lastFailedRun.pendingReason,
        errorMessage: lastFailedRun.errorMessage,
        status: lastFailedRun.status,
      });

      return (
        <StyledContainer>
          <StyledFailureBanner>
            <StyledSectionTitle>Last failed run</StyledSectionTitle>
            <StyledMuted>{lastFailedRun.workflowName}</StyledMuted>
            <strong>{failureLabel}</strong>
          </StyledFailureBanner>
          <StyledCanvas>
            <OutreachWorkflowRunDiagramEmbed
              key={lastFailedRun.workflowRunId}
              workflowRunId={lastFailedRun.workflowRunId}
            />
          </StyledCanvas>
        </StyledContainer>
      );
    }

    return (
      <StyledContainer>
        <StyledMuted>No active workflow runs for this candidate.</StyledMuted>
      </StyledContainer>
    );
  }

  return (
    <StyledContainer>
      <StyledHeader>
        <StyledSectionTitle>
          Active runs ({activeRuns.length})
        </StyledSectionTitle>
        {activeRuns.length > 1 ? (
          <Select<string>
            dropdownId="candidate-workflow-runs-select"
            label="Workflow run"
            value={selectedRun.workflowRunId}
            onChange={setSelectedRunId}
            options={runOptions}
            fullWidth
            selectSizeVariant="small"
            needIconCheck={false}
            withSearchInput={activeRuns.length > 5}
          />
        ) : (
          <StyledMuted>{selectedRun.workflowName}</StyledMuted>
        )}
      </StyledHeader>
      <StyledCanvas>
        <OutreachWorkflowRunDiagramEmbed
          key={selectedRun.workflowRunId}
          workflowRunId={selectedRun.workflowRunId}
        />
      </StyledCanvas>
    </StyledContainer>
  );
};
