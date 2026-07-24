import styled from '@emotion/styled';
import React, { useMemo, useState } from 'react';

type ClientMessage = {
  id: string;
  from: 'recruiter' | 'client';
  role: 'info' | 'fee' | 'process' | 'schedule' | 'offer';
  text: string;
  timestamp: string;
};

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: ${({ theme }) => theme.spacing(3)};
  box-sizing: border-box;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(0.5)};
`;

const StyledTitle = styled.div`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledSubtitle = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledTranscript = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.md};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background-color: ${({ theme }) => theme.background.secondary};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1.5)};
`;

const StyledMessageRow = styled.div<{ from: ClientMessage['from'] }>`
  display: flex;
  justify-content: ${({ from }) => (from === 'recruiter' ? 'flex-end' : 'flex-start')};
`;

const StyledMessageBubble = styled.div<{ from: ClientMessage['from']; role: ClientMessage['role'] }>`
  max-width: 80%;
  padding: ${({ theme }) => theme.spacing(1.5, 2)};
  border-radius: ${({ theme }) => theme.border.radius.lg};
  font-size: ${({ theme }) => theme.font.size.sm};
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;

  ${({ theme, from }) =>
    from === 'recruiter'
      ? `
    background-color: ${theme.color.blue80};
    color: white;
    border-bottom-right-radius: ${theme.border.radius.sm};
  `
      : `
    background-color: ${theme.background.primary};
    color: ${theme.font.color.primary};
    border-bottom-left-radius: ${theme.border.radius.sm};
  `}

  ${({ theme, role }) =>
    role === 'fee'
      ? `box-shadow: 0 0 0 1px ${theme.color.orange}`
      : role === 'offer'
        ? `box-shadow: 0 0 0 1px ${theme.color.green}`
        : ''}
`;

const StyledTimestamp = styled.div`
  margin-top: ${({ theme }) => theme.spacing(0.5)};
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
  text-align: right;
`;

const StyledHint = styled.div`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledFooter = styled.div`
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
  padding-top: ${({ theme }) => theme.spacing(1.5)};
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const MOCK_CLIENT_MESSAGES: ClientMessage[] = [
  {
    id: '1',
    from: 'recruiter',
    role: 'info',
    text: 'Great speaking earlier. Sharing a quick summary of the search so far.',
    timestamp: '09:12',
  },
  {
    id: '2',
    from: 'client',
    role: 'process',
    text: 'Thanks. Can you recap where we are on round 2 interviews?',
    timestamp: '09:15',
  },
  {
    id: '3',
    from: 'recruiter',
    role: 'process',
    text:
      'Sure:\n' +
      '• 6 candidates screened\n' +
      '• 3 moved to round 1 with hiring manager\n' +
      '• 2 in round 2 (both next week)\n' +
      '• 1 candidate paused at your request',
    timestamp: '09:18',
  },
  {
    id: '4',
    from: 'client',
    role: 'fee',
    text:
      'On fees: can we keep the current 22% but split into 2 milestones (offer + 90 days)?',
    timestamp: '09:24',
  },
  {
    id: '5',
    from: 'recruiter',
    role: 'fee',
    text:
      'Yes, that works. I’ll reflect this in the MSA and send for signature today.',
    timestamp: '09:27',
  },
  {
    id: '6',
    from: 'recruiter',
    role: 'schedule',
    text:
      'I’ve proposed interview slots with the panel for Tue/Wed next week. Once you confirm, I’ll coordinate with both candidates.',
    timestamp: '09:30',
  },
  {
    id: '7',
    from: 'client',
    role: 'offer',
    text:
      'Once we are through round 2, please prepare an offer recommendation with comp bands and risk flags for each finalist.',
    timestamp: '09:34',
  },
];

export const ClientChatDrawer: React.FC = () => {
  const [messages] = useState<ClientMessage[]>(MOCK_CLIENT_MESSAGES);

  const orderedMessages = useMemo(
    () => messages.slice().sort((a, b) => a.id.localeCompare(b.id)),
    [messages],
  );

  return (
    <StyledContainer>
      <StyledHeader>
        <StyledTitle>Client conversation (mock)</StyledTitle>
        <StyledSubtitle>
          Overview of fee discussion, interview rounds, scheduling, and offer next steps for this job.
        </StyledSubtitle>
        <StyledHint>
          This is a static mock transcript wired into the right drawer. Later, the assistant can maintain this thread automatically.
        </StyledHint>
      </StyledHeader>
      <StyledTranscript>
        {orderedMessages.map((m) => (
          <StyledMessageRow key={m.id} from={m.from}>
            <div>
              <StyledMessageBubble from={m.from} role={m.role}>
                {m.text}
              </StyledMessageBubble>
              <StyledTimestamp>{m.timestamp}</StyledTimestamp>
            </div>
          </StyledMessageRow>
        ))}
      </StyledTranscript>
      <StyledFooter>
        Client chat is read-only for now. Use this as a design and integration target for a future live client messaging thread.
      </StyledFooter>
    </StyledContainer>
  );
};

