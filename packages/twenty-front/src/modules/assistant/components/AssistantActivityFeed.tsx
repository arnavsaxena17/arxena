import { IconCheck, IconX } from 'twenty-ui/icons';
import type { AssistantAgentEvent } from '@/assistant/types/assistant.types';
import styled from '@emotion/styled';
import { IconActivity } from 'twenty-ui/icons';

const StyledActivityFeed = styled.div`
  flex-shrink: 0;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.secondary};
  max-height: 200px;
  overflow-y: auto;
`;

const StyledActivityHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(2, 3)};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledEventList = styled.ul`
  list-style: none;
  margin: 0;
  padding: ${({ theme }) => theme.spacing(0, 3, 2)};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledEventItem = styled.li<{ $status: AssistantAgentEvent['status'] }>`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(1, 2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
  background: ${({ theme, $status }) =>
    $status === 'error' ? theme.background.danger : theme.background.tertiary};
`;

const StyledEventIcon = styled.span`
  flex-shrink: 0;
  margin-top: 2px;
`;

const StyledEventBody = styled.div`
  flex: 1;
  min-width: 0;
`;

const StyledEventSummary = styled.div`
  word-break: break-word;
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledEventTime = styled.span`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
  margin-top: ${({ theme }) => theme.spacing(1)};
  display: block;
`;

function formatEventStatus(event: AssistantAgentEvent): string {
  switch (event.status) {
    case 'started':
      return 'Agent started';
    case 'completed':
      return 'Agent completed';
    case 'error':
      return 'Agent error';
    case 'tool_call':
      return event.toolName ? `Calling ${event.toolName}…` : 'Tool call';
    default:
      return event.status;
  }
}

function EventIcon({ status }: { status: AssistantAgentEvent['status'] }) {
  switch (status) {
    case 'completed':
      return (
        <StyledEventIcon>
          <IconCheck size={14} />
        </StyledEventIcon>
      );
    case 'error':
      return (
        <StyledEventIcon>
          <IconX size={14} />
        </StyledEventIcon>
      );
    default:
      return (
        <StyledEventIcon>
          <IconActivity size={14} />
        </StyledEventIcon>
      );
  }
}

export type AssistantActivityFeedProps = {
  events: AssistantAgentEvent[];
};

export const AssistantActivityFeed = ({ events }: AssistantActivityFeedProps) => {
  if (events.length === 0) return null;

  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

  return (
    <StyledActivityFeed>
      <StyledActivityHeader>
        <IconActivity size={14} />
        Activity
      </StyledActivityHeader>
      <StyledEventList>
        {sorted.map((evt, i) => (
          <StyledEventItem key={`${evt.timestamp}-${i}`} $status={evt.status}>
            <EventIcon status={evt.status} />
            <StyledEventBody>
              <StyledEventSummary>
                {formatEventStatus(evt)}
                {evt.summary ? `: ${evt.summary}` : ''}
                {evt.error ? ` — ${evt.error}` : ''}
              </StyledEventSummary>
              <StyledEventTime>
                {new Date(evt.timestamp).toLocaleTimeString()}
              </StyledEventTime>
            </StyledEventBody>
          </StyledEventItem>
        ))}
      </StyledEventList>
    </StyledActivityFeed>
  );
};
