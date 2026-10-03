import { styled } from '@linaria/react';
import { Link } from 'react-router-dom';
import {
  OUTREACH_CONVERSATION_STAGE_LABELS,
  OUTREACH_CONVERSATION_STAGES,
} from 'twenty-shared/arx';
import { Tag } from 'twenty-ui/data-display';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { CandidateDrawerActionsDropdown } from '@/candidate-table/components/candidate-drawer/CandidateDrawerActionsDropdown';
import { CandidateDrawerMoreDropdown } from '@/candidate-table/components/candidate-drawer/CandidateDrawerMoreDropdown';
import { STATUS_LABELS } from '@/candidate-table/constants/candidate-status-labels';
import { type useCandidateDrawerRecord } from '@/candidate-table/hooks/useCandidateDrawerRecord';
import { type CandidateOutreachJourney } from '@/outreach-home/types/outreach-journey.types';
import { getOutreachStageTagColor } from '@/outreach-home/utils/outreachTagColors';
import { Select } from '@/ui/input/components/Select';

const StyledHeader = styled.div`
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[4]} ${themeCssVariables.spacing[4]}
    ${themeCssVariables.spacing[3]};
`;

const StyledTopRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  min-width: 0;
`;

const StyledName = styled.h2`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledTopActions = styled.div`
  align-items: center;
  display: flex;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[1]};
  margin-left: auto;
`;

const StyledRole = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledStatusLine = styled.div`
  color: ${themeCssVariables.font.color.primary};
  line-height: ${themeCssVariables.text.lineHeight.lg};
  margin-top: ${themeCssVariables.spacing[1]};
`;

const StyledControlsRow = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[3]};
  margin-top: ${themeCssVariables.spacing[2]};
`;

const StyledStatusControl = styled.div`
  width: 208px;
`;

const StyledPolicy = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledPolicyLink = styled(Link)`
  color: ${themeCssVariables.font.color.secondary};
  text-decoration: none;

  &:hover {
    color: ${themeCssVariables.font.color.primary};
    text-decoration: underline;
  }
`;

const StyledEmpty = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  padding: ${themeCssVariables.spacing[4]};
`;

const CONVERSATION_STAGE_OPTIONS = OUTREACH_CONVERSATION_STAGES.map(
  (stage) => ({
    label: OUTREACH_CONVERSATION_STAGE_LABELS[stage],
    value: stage,
  }),
);

const RECRUITING_STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(
  ([value, label]) => ({ label, value }),
);

type CandidateDrawerHeaderProps = {
  record: ReturnType<typeof useCandidateDrawerRecord>;
  journey: CandidateOutreachJourney | null;
  stageLabel: string | null;
  statusLine: string | null;
  isJourneyActionLoading: boolean;
  canSendNextStepNow: boolean;
  policy: { isDraftApprovalOn: boolean; settingsPath: string } | null;
  onPauseJourney: () => void;
  onResumeJourney: () => void;
  onFollowUpOn: (resumeAt: string) => void;
  onSendNextStepNow: () => void;
  onUpdateConversationStage: (conversationStage: string) => void;
  onStopOutreach: () => void;
};

export const CandidateDrawerHeader = ({
  record,
  journey,
  stageLabel,
  statusLine,
  isJourneyActionLoading,
  canSendNextStepNow,
  policy,
  onPauseJourney,
  onResumeJourney,
  onFollowUpOn,
  onSendNextStepNow,
  onUpdateConversationStage,
  onStopOutreach,
}: CandidateDrawerHeaderProps) => {
  const { fields, activeCandidateId } = record;

  if (fields === null || activeCandidateId === null) {
    return <StyledEmpty>No candidate selected or data not found.</StyledEmpty>;
  }

  const isEnrolled = journey !== null;
  const role = [fields.jobTitle, fields.companyName]
    .filter((part) => part.length > 0)
    .join(' · ');
  const recruitingStatusLabel = STATUS_LABELS[fields.status] ?? fields.status;

  return (
    <StyledHeader>
      <StyledTopRow>
        <StyledName title={fields.name}>{fields.name || 'Unnamed'}</StyledName>
        {isEnrolled && stageLabel !== null ? (
          <Tag
            color={getOutreachStageTagColor(journey.outreachSequenceStage)}
            text={stageLabel}
          />
        ) : recruitingStatusLabel.length > 0 ? (
          <Tag color="gray" text={recruitingStatusLabel} />
        ) : null}
        {journey?.outreachPaused === true && (
          <Tag color="orange" text="Paused" />
        )}
        <StyledTopActions>
          <CandidateDrawerActionsDropdown
            dropdownId={`candidate-drawer-actions-${activeCandidateId}`}
            isJourneyEnrolled={isEnrolled}
            isJourneyPaused={journey?.outreachPaused === true}
            isJourneyActionLoading={isJourneyActionLoading}
            canSendNextStepNow={canSendNextStepNow}
            onPauseJourney={onPauseJourney}
            onResumeJourney={onResumeJourney}
            onFollowUpOn={onFollowUpOn}
            onSendNextStepNow={onSendNextStepNow}
            onMarkNotInterested={() =>
              onUpdateConversationStage('NOT_INTERESTED')
            }
            onStopOutreach={onStopOutreach}
            onStartChat={(chatType) => void record.startChat(chatType)}
            onStopChat={() => void record.stopChat()}
          />
          <CandidateDrawerMoreDropdown
            dropdownId={`candidate-drawer-more-${activeCandidateId}`}
            personId={record.personId}
            candidateId={record.candidateId}
            email={fields.email}
            phone={fields.phone}
            profileUrl={fields.profileUrl}
            onOpenRecord={record.openRecord}
            onCopy={record.copyToClipboard}
          />
        </StyledTopActions>
      </StyledTopRow>
      {role.length > 0 && <StyledRole title={role}>{role}</StyledRole>}
      {statusLine !== null && <StyledStatusLine>{statusLine}</StyledStatusLine>}
      <StyledControlsRow>
        <StyledStatusControl>
          {isEnrolled ? (
            <Select<string>
              dropdownId={`candidate-drawer-conversation-stage-${activeCandidateId}`}
              value={journey.outreachConversationStage || 'NONE'}
              options={CONVERSATION_STAGE_OPTIONS}
              onChange={onUpdateConversationStage}
              disabled={isJourneyActionLoading}
              selectSizeVariant="small"
              fullWidth
              needIconCheck={false}
            />
          ) : (
            <Select<string>
              dropdownId={`candidate-drawer-status-${activeCandidateId}`}
              value={fields.status}
              emptyOption={{ label: 'Set status', value: '' }}
              options={RECRUITING_STATUS_OPTIONS}
              onChange={(status) => {
                if (status.length > 0) {
                  void record.updateStatus(status);
                }
              }}
              selectSizeVariant="small"
              fullWidth
              needIconCheck={false}
            />
          )}
        </StyledStatusControl>
        {policy !== null && (
          <StyledPolicy>
            Draft approval: {policy.isDraftApprovalOn ? 'on' : 'off'} ·{' '}
            <StyledPolicyLink to={policy.settingsPath}>
              Campaign settings
            </StyledPolicyLink>
          </StyledPolicy>
        )}
      </StyledControlsRow>
    </StyledHeader>
  );
};
