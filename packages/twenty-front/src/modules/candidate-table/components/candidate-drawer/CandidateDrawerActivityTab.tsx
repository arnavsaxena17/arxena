import { styled } from '@linaria/react';
import { isNonEmptyString } from '@sniptt/guards';
import { Link } from 'react-router-dom';
import { Tag } from 'twenty-ui/data-display';
import { Loader } from 'twenty-ui/feedback';
import { IconExternalLink, IconRefresh } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { CandidateWorkflowRunsTab } from '@/candidate-table/CandidateWorkflowRunsTab';
import { describeOutreachRunFailure } from '@/candidate-table/utils/candidateDrawerStatus';
import { WORKFLOW_RUN_STATUS_LABELS } from '@/outreach-home/constants/outreach-stages';
import {
  type CandidateOutreachJourney,
  type CandidateOutreachJourneyActiveRun,
} from '@/outreach-home/types/outreach-journey.types';
import { getWorkflowRunStatusTagColor } from '@/outreach-home/utils/outreachTagColors';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]}
    ${themeCssVariables.spacing[6]};
`;

const StyledIntro = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledFailure = styled.div`
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  min-width: 0;
`;

const StyledRunName = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-weight: ${themeCssVariables.font.weight.medium};
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledText = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  line-height: ${themeCssVariables.text.lineHeight.lg};
`;

const StyledActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledDetails = styled.details`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};

  & > summary {
    cursor: pointer;
    user-select: none;
  }
`;

const StyledRawError = styled.pre`
  background: ${themeCssVariables.background.transparent.lighter};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.secondary};
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: ${themeCssVariables.font.size.sm};
  margin: ${themeCssVariables.spacing[1]} 0 0;
  overflow-x: auto;
  padding: ${themeCssVariables.spacing[2]};
  white-space: pre-wrap;
`;

const StyledRunLink = styled(Link)`
  text-decoration: none;
`;

const collectFailedRuns = (
  journey: CandidateOutreachJourney,
): CandidateOutreachJourneyActiveRun[] => {
  const failedRunIds = new Set(
    journey.failedRuns.map((run) => run.workflowRunId),
  );
  const lastFailedRun = journey.lastFailedRun;

  return lastFailedRun !== null &&
    !failedRunIds.has(lastFailedRun.workflowRunId)
    ? [...journey.failedRuns, lastFailedRun]
    : journey.failedRuns;
};

type CandidateDrawerActivityTabProps = {
  journey: CandidateOutreachJourney | null;
  isLoading: boolean;
  isRetrying: boolean;
  onRetry: () => void;
};

export const CandidateDrawerActivityTab = ({
  journey,
  isLoading,
  isRetrying,
  onRetry,
}: CandidateDrawerActivityTabProps) => {
  if (journey === null) {
    return (
      <StyledContainer>
        {isLoading ? (
          <Loader />
        ) : (
          <StyledIntro>
            Not enrolled in outreach, so there are no workflow runs.
          </StyledIntro>
        )}
      </StyledContainer>
    );
  }

  const failedRuns = collectFailedRuns(journey);
  const hasActiveRun = journey.activeRuns.length > 0;
  const runCount = journey.activeRuns.length + failedRuns.length;

  return (
    <StyledContainer>
      <StyledIntro>
        For debugging. {runCount} {runCount === 1 ? 'run' : 'runs'} on this
        person; the target is one active run at a time.
      </StyledIntro>

      {failedRuns.map((run) => (
        <StyledFailure key={run.workflowRunId}>
          <StyledRow>
            <Tag color="red" text="Failed" />
            <StyledRunName title={run.workflowName}>
              {run.workflowName}
            </StyledRunName>
          </StyledRow>
          <StyledText>
            {describeOutreachRunFailure({
              errorMessage: run.errorMessage,
              currentStepName: run.currentStepName,
            })}
          </StyledText>
          <StyledActions>
            <Button
              Icon={IconRefresh}
              title={isRetrying ? 'Retrying…' : 'Retry'}
              variant="primary"
              accent="blue"
              size="small"
              disabled={hasActiveRun || isRetrying}
              onClick={onRetry}
            />
            <StyledRunLink to={`/object/workflowRun/${run.workflowRunId}`}>
              <Button
                Icon={IconExternalLink}
                title="Open run"
                variant="secondary"
                size="small"
              />
            </StyledRunLink>
          </StyledActions>
          {hasActiveRun && (
            <StyledIntro>
              Retry is off while another run is active for this person.
            </StyledIntro>
          )}
          {isNonEmptyString(run.errorMessage) && (
            <StyledDetails>
              <summary>Raw error</summary>
              <StyledRawError>{run.errorMessage}</StyledRawError>
            </StyledDetails>
          )}
        </StyledFailure>
      ))}

      {journey.activeRuns.map((run) => (
        <StyledRow key={run.workflowRunId}>
          <Tag
            color={getWorkflowRunStatusTagColor(run.status)}
            text={WORKFLOW_RUN_STATUS_LABELS[run.status] ?? run.status}
          />
          <StyledRunName title={run.workflowName}>
            {run.workflowName}
            {isNonEmptyString(run.currentStepName)
              ? ` · ${run.currentStepName}`
              : ''}
          </StyledRunName>
        </StyledRow>
      ))}

      {runCount > 0 && (
        <CandidateWorkflowRunsTab
          activeRuns={journey.activeRuns}
          failedRuns={journey.failedRuns}
          lastFailedRun={journey.lastFailedRun}
          isLoading={isLoading}
          hideFailureBanner
        />
      )}
    </StyledContainer>
  );
};
