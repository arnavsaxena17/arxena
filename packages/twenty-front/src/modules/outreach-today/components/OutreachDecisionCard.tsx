import { useState } from 'react';
import { styled } from '@linaria/react';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { type OutreachDecisionListItem } from '@/outreach-today/types/outreach-decision.types';

const StyledCard = styled.div`
  background: ${themeCssVariables.background.transparent.light};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledTitle = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledMeta = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledBody = styled.pre`
  color: ${themeCssVariables.font.color.secondary};
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.sm};
  margin: 0;
  white-space: pre-wrap;
`;

const StyledActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledTextArea = styled.textarea`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.sm};
  min-height: 96px;
  padding: ${themeCssVariables.spacing[2]};
  resize: vertical;
`;

type OutreachDecisionCardProps = {
  decision: OutreachDecisionListItem;
  isResolving: boolean;
  onApprove: () => void;
  onEdit: (editedBody: string) => void;
  onReject: () => void;
};

export const OutreachDecisionCard = ({
  decision,
  isResolving,
  onApprove,
  onEdit,
  onReject,
}: OutreachDecisionCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedBody, setEditedBody] = useState(decision.draftBody);
  const who = [decision.personName, decision.personTitle, decision.companyName]
    .filter((part) => part.length > 0)
    .join(' · ');

  return (
    <StyledCard>
      <StyledTitle>{decision.title}</StyledTitle>
      {who.length > 0 ? <StyledMeta>{who}</StyledMeta> : null}
      <StyledMeta>{decision.recommendation}</StyledMeta>
      {isEditing ? (
        <StyledTextArea
          value={editedBody}
          onChange={(event) => setEditedBody(event.target.value)}
        />
      ) : decision.draftBody.length > 0 ? (
        <StyledBody>{decision.draftBody}</StyledBody>
      ) : null}
      <StyledActions>
        {isEditing ? (
          <Button
            title="Save and approve"
            variant="primary"
            size="small"
            disabled={isResolving || editedBody.trim().length === 0}
            onClick={() => onEdit(editedBody.trim())}
          />
        ) : (
          <Button
            title="Approve"
            variant="primary"
            size="small"
            disabled={isResolving}
            onClick={onApprove}
          />
        )}
        <Button
          title={isEditing ? 'Cancel edit' : 'Edit'}
          variant="secondary"
          size="small"
          disabled={isResolving}
          onClick={() => {
            setEditedBody(decision.draftBody);
            setIsEditing((current) => !current);
          }}
        />
        <Button
          title="Reject"
          variant="secondary"
          size="small"
          disabled={isResolving}
          onClick={onReject}
        />
      </StyledActions>
    </StyledCard>
  );
};
