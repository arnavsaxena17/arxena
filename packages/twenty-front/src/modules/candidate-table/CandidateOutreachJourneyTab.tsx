import { styled } from '@linaria/react';
import { useMemo, useState } from 'react';
import {
  OUTREACH_CONVERSATION_STAGE_LABELS,
  OUTREACH_CONVERSATION_STAGES,
} from 'twenty-shared/arx';
import { Loader } from 'twenty-ui/feedback';
import { Button, type SelectOption } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { OUTREACH_JOURNEY_TIMELINE_STAGES } from '@/outreach-home/constants/outreach-journey-stages';
import { type CandidateOutreachJourney } from '@/outreach-home/types/outreach-journey.types';
import {
  resolveOutreachJourneyStageLabel,
  resolveOutreachJourneyTimelineStageId,
  resolveOutreachNextRetryLabel,
  resolveOutreachPendingStepLabel,
} from '@/outreach-home/utils/resolveOutreachJourneyLabels';
import { Select } from '@/ui/input/components/Select';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[5]};
  padding: ${themeCssVariables.spacing[3]};
  padding-bottom: ${themeCssVariables.spacing[8]};
`;

const StyledSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledSectionTitle = styled.h3`
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  letter-spacing: -0.01em;
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
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${({ isActive }) =>
    isActive
      ? themeCssVariables.font.weight.medium
      : themeCssVariables.font.weight.regular};
  padding: ${themeCssVariables.spacing[1]} 0 ${themeCssVariables.spacing[1]}
    ${themeCssVariables.spacing[2]};
`;

const StyledCard = styled.div`
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledStepPrimary = styled.p`
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  line-height: 1.4;
  margin: 0;
`;

const StyledMuted = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.45;
  margin: 0;
`;

const StyledMetaRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledTextArea = styled.textarea`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.45;
  min-height: 96px;
  outline: none;
  padding: ${themeCssVariables.spacing[2]};
  resize: vertical;
  width: 100%;

  &:focus {
    border-color: ${themeCssVariables.color.blue};
  }
`;

const StyledActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledFieldStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledFieldLabel = styled.span`
  color: ${themeCssVariables.font.color.secondary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledFieldRow = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledDateTimeInput = styled.input`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.primary};
  flex: 1;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  min-width: 180px;
  outline: none;
  padding: ${themeCssVariables.spacing[2]};

  &:focus {
    border-color: ${themeCssVariables.color.blue};
  }
`;

const StyledDivider = styled.div`
  background: ${themeCssVariables.border.color.light};
  height: 1px;
  width: 100%;
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
      outreachConversationStage: journey.outreachConversationStage,
    });
  }, [journey]);

  const pendingStepLabel = useMemo(() => {
    if (primaryRun) {
      return resolveOutreachPendingStepLabel({
        currentStepName: primaryRun.currentStepName,
        currentStepKind: primaryRun.currentStepKind,
        pendingReason: primaryRun.pendingReason,
        errorMessage: primaryRun.errorMessage,
        status: primaryRun.status,
      });
    }

    if (journey?.lastFailedRun) {
      return resolveOutreachPendingStepLabel({
        currentStepName: journey.lastFailedRun.currentStepName,
        currentStepKind: journey.lastFailedRun.currentStepKind,
        pendingReason: journey.lastFailedRun.pendingReason,
        errorMessage: journey.lastFailedRun.errorMessage,
        status: journey.lastFailedRun.status,
      });
    }

    return 'No active workflow run';
  }, [journey?.lastFailedRun, primaryRun]);

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

  const conversationStageOptions: SelectOption<string>[] = useMemo(
    () =>
      OUTREACH_CONVERSATION_STAGES.map((stage) => ({
        label: OUTREACH_CONVERSATION_STAGE_LABELS[stage],
        value: stage,
      })),
    [],
  );

  const selectedConversationStage =
    conversationStage ?? journey?.outreachConversationStage ?? 'NONE';

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
          No enrolled outreach journey for this candidate in the current
          project.
        </StyledMuted>
      </StyledContainer>
    );
  }

  const draftValue = editedDraft || primaryRun?.draftPreview || '';
  const workflowName =
    primaryRun?.workflowName ??
    journey.lastFailedRun?.workflowName ??
    'No active run';

  const activeTimelineStage = resolveOutreachJourneyTimelineStageId({
    outreachSequenceStage: journey.outreachSequenceStage,
    linkedinFollowUpCount: journey.linkedinFollowUpCount,
    outreachConversationStage: journey.outreachConversationStage,
  });

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
        <StyledMetaRow>
          <StyledMuted>Current: {stageLabel}</StyledMuted>
          {journey.outreachResumeAt ? (
            <StyledMuted>
              Next follow-up{' '}
              {new Date(journey.outreachResumeAt).toLocaleString()}
            </StyledMuted>
          ) : null}
        </StyledMetaRow>
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>Active step</StyledSectionTitle>
        <StyledCard>
          <StyledMetaRow>
            <StyledMuted>{workflowName}</StyledMuted>
            <StyledStepPrimary>{pendingStepLabel}</StyledStepPrimary>
          </StyledMetaRow>
          {!primaryRun && journey.lastFailedRun?.errorMessage ? (
            <StyledMuted>{journey.lastFailedRun.errorMessage}</StyledMuted>
          ) : null}
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
                  size="small"
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
                  size="small"
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
        </StyledCard>
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>Controls</StyledSectionTitle>
        <StyledCard>
          <StyledFieldStack>
            <StyledFieldLabel>Journey</StyledFieldLabel>
            <StyledActions>
              {journey.outreachPaused ? (
                <Button
                  title="Resume journey"
                  size="small"
                  disabled={isActionLoading}
                  onClick={onResume}
                />
              ) : (
                <Button
                  title="Pause journey"
                  size="small"
                  variant="secondary"
                  disabled={isActionLoading}
                  onClick={onPause}
                />
              )}
              <Button
                title="Stop outreach"
                size="small"
                variant="secondary"
                accent="danger"
                onClick={onStop}
              />
              {primaryRun?.currentStepKind === 'DELAY' &&
              primaryRun.pendingStepId ? (
                <Button
                  title="Send now"
                  size="small"
                  variant="secondary"
                  disabled={isActionLoading}
                  onClick={() => {
                    if (!primaryRun.pendingStepId) {
                      return;
                    }

                    onSkipDelay(
                      primaryRun.workflowRunId,
                      primaryRun.pendingStepId,
                    );
                  }}
                />
              ) : null}
            </StyledActions>
          </StyledFieldStack>

          <StyledDivider />

          <StyledFieldStack>
            <Select
              dropdownId="candidate-outreach-journey-conversation-stage"
              label="Conversation stage"
              fullWidth
              selectSizeVariant="small"
              options={conversationStageOptions}
              value={selectedConversationStage}
              onChange={(value) => setConversationStage(value)}
            />
            <StyledFieldRow>
              <Button
                title="Save stage"
                size="small"
                variant="secondary"
                disabled={isActionLoading}
                onClick={() =>
                  onUpdateOperatorControls({
                    outreachConversationStage: selectedConversationStage,
                  })
                }
              />
            </StyledFieldRow>
          </StyledFieldStack>

          <StyledDivider />

          <StyledFieldStack>
            <StyledFieldLabel>Follow-up / snooze</StyledFieldLabel>
            <StyledDateTimeInput
              type="datetime-local"
              value={snoozeDate}
              onChange={(event) => setSnoozeDate(event.target.value)}
            />
            <StyledFieldRow>
              <Button
                title="Set next follow-up"
                size="small"
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
                size="small"
                variant="secondary"
                disabled={isActionLoading || !snoozeDate}
                onClick={() => {
                  if (!snoozeDate) {
                    return;
                  }

                  onSnooze(new Date(snoozeDate).toISOString());
                }}
              />
            </StyledFieldRow>
          </StyledFieldStack>

          <StyledDivider />

          <StyledActions>
            <Button
              title="Mark not interested"
              size="small"
              variant="secondary"
              accent="danger"
              disabled={isActionLoading}
              onClick={() =>
                onUpdateOperatorControls({
                  outreachConversationStage: 'NOT_INTERESTED',
                })
              }
            />
          </StyledActions>
        </StyledCard>
      </StyledSection>
    </StyledContainer>
  );
};

export const resolveJourneyHeaderLabels = (
  journey: CandidateOutreachJourney | null,
) => {
  const primaryRun = journey?.activeRuns[0] ?? null;
  const failedRun = journey?.lastFailedRun ?? null;
  const displayRun = primaryRun ?? failedRun;

  return {
    outreachStageLabel: journey
      ? resolveOutreachJourneyStageLabel({
          outreachSequenceStage: journey.outreachSequenceStage,
          linkedinFollowUpCount: journey.linkedinFollowUpCount,
          outreachConversationStage: journey.outreachConversationStage,
        })
      : null,
    outreachNextStepLabel: displayRun
      ? resolveOutreachPendingStepLabel({
          currentStepName: displayRun.currentStepName,
          currentStepKind: displayRun.currentStepKind,
          pendingReason: displayRun.pendingReason,
          errorMessage: displayRun.errorMessage,
          status: displayRun.status,
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
