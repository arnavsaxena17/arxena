import { styled } from '@linaria/react';
import { useMemo, useState } from 'react';
import {
  OUTREACH_CONVERSATION_STAGE_LABELS,
  OUTREACH_CONVERSATION_STAGES,
} from 'twenty-shared/arx';
import { Loader } from 'twenty-ui/feedback';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { OUTREACH_JOURNEY_TIMELINE_STAGES } from '@/outreach-home/constants/outreach-journey-stages';
import { type CandidateOutreachJourney } from '@/outreach-home/types/outreach-journey.types';
import {
  resolveOutreachJourneyStageLabel,
  resolveOutreachNextRetryLabel,
  resolveOutreachPendingStepLabel,
} from '@/outreach-home/utils/resolveOutreachJourneyLabels';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledSectionTitle = styled.h3`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin: 0;
`;

const StyledTimeline = styled.ol`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  list-style: none;
  margin: 0;
  padding: 0;
`;

const StyledTimelineItem = styled.li<{ isActive: boolean }>`
  border-left: 2px solid
    ${({ isActive }) =>
      isActive
        ? themeCssVariables.color.blue
        : themeCssVariables.border.color.medium};
  color: ${({ isActive }) =>
    isActive
      ? themeCssVariables.font.color.primary
      : themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  padding-left: ${themeCssVariables.spacing[2]};
`;

const StyledCard = styled.div`
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledMuted = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  margin: 0;
`;

const StyledTextArea = styled.textarea`
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.sm};
  min-height: 96px;
  padding: ${themeCssVariables.spacing[2]};
  resize: vertical;
  width: 100%;
`;

const StyledActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledSnoozeRow = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledSelect = styled.select`
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[1]};
`;

type CandidateOutreachJourneyTabProps = {
  journey: CandidateOutreachJourney | null;
  isLoading: boolean;
  isActionLoading: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSnooze: (resumeAt: string) => void;
  onUpdateOperatorControls: (input: {
    outreachConversationStage?: string;
    resumeAt?: string | null;
  }) => void;
  onSkipDelay: (workflowRunId: string, stepId: string) => void;
  onApproveForm: (input: {
    workflowRunId: string;
    stepId: string;
    editedBody: string;
    approve?: boolean;
  }) => void;
};

export const CandidateOutreachJourneyTab = ({
  journey,
  isLoading,
  isActionLoading,
  onPause,
  onResume,
  onStop,
  onSnooze,
  onUpdateOperatorControls,
  onSkipDelay,
  onApproveForm,
}: CandidateOutreachJourneyTabProps) => {
  const [editedDraft, setEditedDraft] = useState('');
  const [snoozeDate, setSnoozeDate] = useState('');
  const [conversationStage, setConversationStage] = useState<string | null>(
    null,
  );

  const primaryRun = journey?.activeRuns[0] ?? null;
  const hasFormPending = primaryRun?.currentStepKind === 'FORM';

  const stageLabel = useMemo(() => {
    if (!journey) {
      return '';
    }

    return resolveOutreachJourneyStageLabel({
      outreachSequenceStage: journey.outreachSequenceStage,
      linkedinFollowUpCount: journey.linkedinFollowUpCount,
      hasFormPending,
    });
  }, [hasFormPending, journey]);

  const pendingStepLabel = useMemo(() => {
    if (!primaryRun) {
      return 'No active workflow run';
    }

    return resolveOutreachPendingStepLabel({
      currentStepName: primaryRun.currentStepName,
      currentStepKind: primaryRun.currentStepKind,
      pendingReason: primaryRun.pendingReason,
    });
  }, [primaryRun]);

  const nextRetryLabel = useMemo(() => {
    if (!primaryRun) {
      return null;
    }

    return resolveOutreachNextRetryLabel({
      currentStepKind: primaryRun.currentStepKind,
      resumeAt: primaryRun.resumeAt,
      pendingReason: primaryRun.pendingReason,
    });
  }, [primaryRun]);

  if (isLoading && !journey) {
    return (
      <StyledContainer>
        <Loader />
      </StyledContainer>
    );
  }

  if (!journey) {
    return (
      <StyledContainer>
        <StyledMuted>
          No enrolled outreach journey for this candidate in the current project.
        </StyledMuted>
      </StyledContainer>
    );
  }

  const draftValue = editedDraft || primaryRun?.draftPreview || '';

  const activeTimelineStage = hasFormPending
    ? 'FORM_PENDING'
    : journey.linkedinFollowUpCount >= 3
      ? 'FOLLOW_UP_3'
      : journey.linkedinFollowUpCount === 2
        ? 'FOLLOW_UP_2'
        : journey.linkedinFollowUpCount === 1
          ? 'FOLLOW_UP_1'
          : journey.outreachSequenceStage;

  return (
    <StyledContainer>
      <StyledSection>
        <StyledSectionTitle>Stage timeline</StyledSectionTitle>
        <StyledTimeline>
          {OUTREACH_JOURNEY_TIMELINE_STAGES.map((timelineStage) => (
            <StyledTimelineItem
              key={timelineStage.id}
              isActive={timelineStage.id === activeTimelineStage}
            >
              {timelineStage.label}
            </StyledTimelineItem>
          ))}
        </StyledTimeline>
        <StyledMuted>Current: {stageLabel}</StyledMuted>
        {journey.outreachResumeAt ? (
          <StyledMuted>
            Next follow-up {new Date(journey.outreachResumeAt).toLocaleString()}
          </StyledMuted>
        ) : null}
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>Active step</StyledSectionTitle>
        <StyledCard>
          <StyledMuted>{primaryRun?.workflowName ?? 'No active run'}</StyledMuted>
          <strong>{pendingStepLabel}</strong>
          {nextRetryLabel ? (
            <StyledMuted>Next retry {nextRetryLabel}</StyledMuted>
          ) : null}
          {journey.pendingChannel ? (
            <StyledMuted>Channel: {journey.pendingChannel}</StyledMuted>
          ) : null}
          {primaryRun?.draftPreview && hasFormPending ? (
            <>
              <StyledTextArea
                value={draftValue}
                onChange={(event) => setEditedDraft(event.target.value)}
              />
              <StyledActions>
                <Button
                  title="Approve & send"
                  disabled={isActionLoading || !primaryRun.pendingFormStepId}
                  onClick={() => {
                    if (!primaryRun.pendingFormStepId) {
                      return;
                    }

                    onApproveForm({
                      workflowRunId: primaryRun.workflowRunId,
                      stepId: primaryRun.pendingFormStepId,
                      editedBody: draftValue,
                    });
                  }}
                />
                <Button
                  title="Reject"
                  variant="secondary"
                  disabled={isActionLoading || !primaryRun.pendingFormStepId}
                  onClick={() => {
                    if (!primaryRun.pendingFormStepId) {
                      return;
                    }

                    onApproveForm({
                      workflowRunId: primaryRun.workflowRunId,
                      stepId: primaryRun.pendingFormStepId,
                      editedBody: draftValue,
                      approve: false,
                    });
                  }}
                />
              </StyledActions>
            </>
          ) : null}
          {primaryRun?.upcomingSteps ? (
            <StyledMuted>Up next: {primaryRun.upcomingSteps}</StyledMuted>
          ) : null}
        </StyledCard>
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>Controls</StyledSectionTitle>
        <StyledActions>
          {journey.outreachPaused ? (
            <Button
              title="Resume journey"
              disabled={isActionLoading}
              onClick={onResume}
            />
          ) : (
            <Button
              title="Pause journey"
              variant="secondary"
              disabled={isActionLoading}
              onClick={onPause}
            />
          )}
          <Button
            title="Stop outreach"
            variant="secondary"
            onClick={onStop}
          />
          {primaryRun?.currentStepKind === 'DELAY' &&
          primaryRun.pendingStepId ? (
            <Button
              title="Send now"
              variant="secondary"
              disabled={isActionLoading}
              onClick={() => {
                if (!primaryRun.pendingStepId) {
                  return;
                }

                onSkipDelay(primaryRun.workflowRunId, primaryRun.pendingStepId);
              }}
            />
          ) : null}
        </StyledActions>
        <StyledSnoozeRow>
          <StyledSelect
            value={
              conversationStage ?? journey.outreachConversationStage ?? 'NONE'
            }
            onChange={(event) => setConversationStage(event.target.value)}
          >
            {OUTREACH_CONVERSATION_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {OUTREACH_CONVERSATION_STAGE_LABELS[stage]}
              </option>
            ))}
          </StyledSelect>
          <Button
            title="Save stage"
            variant="secondary"
            disabled={isActionLoading}
            onClick={() =>
              onUpdateOperatorControls({
                outreachConversationStage:
                  conversationStage ??
                  journey.outreachConversationStage ??
                  'NONE',
              })
            }
          />
        </StyledSnoozeRow>
        <StyledSnoozeRow>
          <input
            type="datetime-local"
            value={snoozeDate}
            onChange={(event) => setSnoozeDate(event.target.value)}
          />
          <Button
            title="Set next follow-up"
            variant="secondary"
            disabled={isActionLoading || !snoozeDate}
            onClick={() => {
              if (!snoozeDate) {
                return;
              }

              onUpdateOperatorControls({
                resumeAt: new Date(snoozeDate).toISOString(),
              });
            }}
          />
          <Button
            title="Snooze until"
            variant="secondary"
            disabled={isActionLoading || !snoozeDate}
            onClick={() => {
              if (!snoozeDate) {
                return;
              }

              onSnooze(new Date(snoozeDate).toISOString());
            }}
          />
        </StyledSnoozeRow>
        <StyledActions>
          <Button
            title="Mark not interested"
            variant="secondary"
            disabled={isActionLoading}
            onClick={() =>
              onUpdateOperatorControls({
                outreachConversationStage: 'NOT_INTERESTED',
              })
            }
          />
        </StyledActions>
      </StyledSection>
    </StyledContainer>
  );
};

export const resolveJourneyHeaderLabels = (
  journey: CandidateOutreachJourney | null,
) => {
  const primaryRun = journey?.activeRuns[0] ?? null;
  const hasFormPending = primaryRun?.currentStepKind === 'FORM';

  return {
    outreachStageLabel: journey
      ? resolveOutreachJourneyStageLabel({
          outreachSequenceStage: journey.outreachSequenceStage,
          linkedinFollowUpCount: journey.linkedinFollowUpCount,
          hasFormPending,
        })
      : null,
    outreachNextStepLabel: primaryRun
      ? resolveOutreachPendingStepLabel({
          currentStepName: primaryRun.currentStepName,
          currentStepKind: primaryRun.currentStepKind,
          pendingReason: primaryRun.pendingReason,
        })
      : null,
    outreachNextRetryLabel: primaryRun
      ? resolveOutreachNextRetryLabel({
          currentStepKind: primaryRun.currentStepKind,
          resumeAt: primaryRun.resumeAt,
          pendingReason: primaryRun.pendingReason,
        })
      : null,
    pendingChannel: journey?.pendingChannel ?? null,
  };
};
