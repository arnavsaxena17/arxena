import { IconChevronDown, IconChevronRight } from 'twenty-ui/icons';
import type { AgentNote } from '@/assistant/types/assistant.types';
import styled from '@emotion/styled';
import { useCallback, useState } from 'react';

const StyledNotesSection = styled.div`
  flex-shrink: 0;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.secondary};
`;

const StyledNotesHeader = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  width: 100%;
  padding: ${({ theme }) => theme.spacing(2, 3)};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.secondary};
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;

  &:hover {
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledNotesList = styled.ul`
  list-style: none;
  margin: 0;
  padding: ${({ theme }) => theme.spacing(0, 3, 2)};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledNoteItem = styled.li`
  padding: ${({ theme }) => theme.spacing(1, 2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
  background: ${({ theme }) => theme.background.tertiary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
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
