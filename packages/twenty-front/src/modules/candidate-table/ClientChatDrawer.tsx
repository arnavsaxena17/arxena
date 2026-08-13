import { styled } from '@linaria/react';
import React, { useMemo, useState } from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

type ClientMessage = {
  id: string;
  from: 'recruiter' | 'client';
  role: 'info' | 'fee' | 'process' | 'schedule' | 'offer';
  text: string;
  timestamp: string;
};

const StyledContainer = styled.div`
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  height: 100%;
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[0.5]};
`;

const StyledTitle = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledSubtitle = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledTranscript = styled.div`
  background-color: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1.5]};
  min-height: 0;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[2]};
`;

const StyledMessageRow = styled.div<{ from: ClientMessage['from'] }>`
  display: flex;
  justify-content: ${({ from }) => (from === 'recruiter' ? 'flex-end' : 'flex-start')};
`;

const StyledMessageBubble = styled.div<{
  from: ClientMessage['from'];
  role: ClientMessage['role'];
}>`
  background-color: ${({ from }) =>
    from === 'recruiter'
      ? themeCssVariables.color.blue8
      : themeCssVariables.background.primary};
  border-bottom-left-radius: ${({ from }) =>
    from === 'recruiter'
      ? themeCssVariables.border.radius.lg
      : themeCssVariables.border.radius.sm};
  border-bottom-right-radius: ${({ from }) =>
    from === 'recruiter'
      ? themeCssVariables.border.radius.sm
      : themeCssVariables.border.radius.lg};
  border-radius: ${themeCssVariables.border.radius.lg};
  box-shadow: ${({ role }) => {
    if (role === 'fee') {
      return `0 0 0 1px ${themeCssVariables.color.orange}`;
    }
    if (role === 'offer') {
      return `0 0 0 1px ${themeCssVariables.color.green}`;
    }
    return 'none';
  }};
  color: ${({ from }) =>
    from === 'recruiter' ? 'white' : themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.5;
  max-width: 80%;
  padding: ${themeCssVariables.spacing[1.5]} ${themeCssVariables.spacing[2]};
  white-space: pre-wrap;
  word-break: break-word;
`;

const StyledTimestamp = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  margin-top: ${themeCssVariables.spacing[0.5]};
  text-align: right;
`;

const StyledHint = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
`;

const StyledFooter = styled.div`
  border-top: 1px solid ${themeCssVariables.border.color.light};
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  padding-top: ${themeCssVariables.spacing[1.5]};
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

