import { styled } from '@linaria/react';
import { isNonEmptyString } from '@sniptt/guards';
import { useState } from 'react';
import {
  IconCheck,
  IconPencil,
  IconPlayerStop,
  IconSend,
  IconX,
} from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { type OutreachDecisionListItem } from '@/outreach-today/types/outreach-decision.types';

const StyledCard = styled.div<{ tone: 'attention' | 'resolved' }>`
  background: ${({ tone }) =>
    tone === 'attention'
      ? themeCssVariables.background.transparent.danger
      : themeCssVariables.background.transparent.lighter};
  border: 1px solid
    ${({ tone }) =>
      tone === 'attention'
        ? themeCssVariables.border.color.danger
        : themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  margin: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]} 0;
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]};
`;

const StyledTitle = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

const StyledText = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  line-height: ${themeCssVariables.text.lineHeight.lg};
`;

const StyledDraft = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  line-height: ${themeCssVariables.text.lineHeight.lg};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  white-space: pre-wrap;
`;

const StyledTextArea = styled.textarea`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.color.blue};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.primary};
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.md};
  line-height: ${themeCssVariables.text.lineHeight.lg};
  min-height: 112px;
  outline: none;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  resize: vertical;
  width: 100%;
`;

const StyledActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledFootnote = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

export type CandidateDrawerPendingDraft = {
  title: string;
  body: string;
};

type CandidateDrawerNeedsYouCardProps = {
  decision: OutreachDecisionListItem | null;
  moreDecisionCount: number;
  pendingDraft: CandidateDrawerPendingDraft | null;
  isBusy: boolean;
  wasJustResolved: boolean;
  onApprove: (editedBody: string | null) => void;
  onReject: () => void;
  onStopOutreach: () => void;
};

// Pinned above the tabs, only when something is waiting on the user. The
// drawer resolves decisions here instead of only displaying data.
export const CandidateDrawerNeedsYouCard = ({
  decision,
  moreDecisionCount,
  pendingDraft,
  isBusy,
  wasJustResolved,
  onApprove,
  onReject,
  onStopOutreach,
}: CandidateDrawerNeedsYouCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedBody, setEditedBody] = useState('');

  const title = decision?.title ?? pendingDraft?.title ?? null;
  const draftBody = decision?.draftBody ?? pendingDraft?.body ?? '';

  if (title === null) {
    return wasJustResolved ? (
      <StyledCard tone="resolved">
        <StyledTitle>Decision recorded</StyledTitle>
        <StyledText>Saved. The sequence picks up from here.</StyledText>
      </StyledCard>
    ) : null;
  }

  const startEditing = () => {
    setEditedBody(draftBody);
    setIsEditing(true);
  };

  const finish = (action: () => void) => () => {
    action();
    setIsEditing(false);
  };

  return (
    <StyledCard tone="attention">
      <StyledTitle>Needs you: {title}</StyledTitle>
      {isNonEmptyString(decision?.recommendation) && (
        <StyledText>
          <strong>Agent:</strong> {decision.recommendation}
        </StyledText>
      )}
      {isEditing ? (
        <StyledTextArea
          aria-label="Edit draft"
          value={editedBody}
          onChange={(event) => setEditedBody(event.target.value)}
        />
      ) : (
        isNonEmptyString(draftBody) && <StyledDraft>{draftBody}</StyledDraft>
      )}
      <StyledActions>
        {isEditing ? (
          <Button
            Icon={IconSend}
            title="Save and send"
            variant="primary"
            accent="blue"
            size="small"
            disabled={isBusy || editedBody.trim().length === 0}
            onClick={finish(() => onApprove(editedBody.trim()))}
          />
        ) : (
          <Button
            Icon={isNonEmptyString(draftBody) ? IconSend : IconCheck}
            title={isNonEmptyString(draftBody) ? 'Approve and send' : 'Approve'}
            variant="primary"
            accent="blue"
            size="small"
            disabled={isBusy}
            onClick={() => onApprove(null)}
          />
        )}
        {isNonEmptyString(draftBody) && (
          <Button
            Icon={isEditing ? IconX : IconPencil}
            title={isEditing ? 'Cancel edit' : 'Edit'}
            variant="secondary"
            size="small"
            disabled={isBusy}
            onClick={isEditing ? () => setIsEditing(false) : startEditing}
          />
        )}
        <Button
          title="Reject"
          variant="secondary"
          size="small"
          disabled={isBusy}
          onClick={finish(onReject)}
        />
        <Button
          Icon={IconPlayerStop}
          title="Stop outreach"
          variant="secondary"
          accent="danger"
          size="small"
          disabled={isBusy}
          onClick={onStopOutreach}
        />
      </StyledActions>
      {moreDecisionCount > 0 && (
        <StyledFootnote>
          {moreDecisionCount} more open{' '}
          {moreDecisionCount === 1 ? 'decision' : 'decisions'} for this person
          on Today
        </StyledFootnote>
      )}
    </StyledCard>
  );
};
