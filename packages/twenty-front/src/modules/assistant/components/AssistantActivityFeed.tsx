import { IconCheck, IconClock, IconX } from 'twenty-ui/icon';
import type { AssistantAgentEvent } from '@/assistant/types/assistant.types';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledActivityFeed = styled.div`
  flex-shrink: 0;
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  background: ${themeCssVariables.background.secondary};
  max-height: 200px;
  overflow-y: auto;
`;

const StyledActivityHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${themeCssVariables.font.color.secondary};
`;

const StyledEventList = styled.ul`
  list-style: none;
  margin: 0;
  padding: ${themeCssVariables.spacing[0]} ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[2]};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledEventItem = styled.li<{ $status: AssistantAgentEvent['status'] }>`
  display: flex;
  align-items: flex-start;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.primary};
  background: ${({ $status }) =>
    $status === 'error' ? themeCssVariables.background.danger : themeCssVariables.background.tertiary};
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
  color: ${themeCssVariables.font.color.primary};
`;

const StyledEventTime = styled.span`
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.font.color.tertiary};
  margin-top: ${themeCssVariables.spacing[1]};
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
          <IconClock size={14} />
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
        <IconClock size={14} />
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
