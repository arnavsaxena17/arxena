import { IconChevronDown, IconChevronRight } from 'twenty-ui/icon';
import type { AgentNote } from '@/assistant/types/assistant.types';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useCallback, useState } from 'react';

const StyledNotesSection = styled.div`
  flex-shrink: 0;
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  background: ${themeCssVariables.background.secondary};
`;

const StyledNotesHeader = styled.button`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
  width: 100%;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${themeCssVariables.font.color.secondary};
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;

  &:hover {
    color: ${themeCssVariables.font.color.primary};
  }
`;

const StyledNotesList = styled.ul`
  list-style: none;
  margin: 0;
  padding: ${themeCssVariables.spacing[0]} ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[2]};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledNoteItem = styled.li`
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.primary};
  background: ${themeCssVariables.background.tertiary};
  border: 1px solid ${themeCssVariables.border.color.light};
`;

type AssistantThreadNotesProps = {
  agentNotes: AgentNote[] | undefined;
};

export const AssistantThreadNotes = ({ agentNotes }: AssistantThreadNotesProps) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const toggle = useCallback(() => setIsExpanded((prev) => !prev), []);

  if (!agentNotes?.length) return null;

  return (
    <StyledNotesSection>
      <StyledNotesHeader type="button" onClick={toggle} aria-expanded={isExpanded}>
        {isExpanded ? (
          <IconChevronDown size={14} />
        ) : (
          <IconChevronRight size={14} />
        )}
        Agent notes ({agentNotes.length})
      </StyledNotesHeader>
      {isExpanded && (
        <StyledNotesList>
          {agentNotes.map((note, i) => (
            <StyledNoteItem key={note.id ?? i}>{note.summary}</StyledNoteItem>
          ))}
        </StyledNotesList>
      )}
    </StyledNotesSection>
  );
};
