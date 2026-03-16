import { AssistantActivityFeed } from '@/assistant/components/AssistantActivityFeed';
import { AssistantThreadNotes } from '@/assistant/components/AssistantThreadNotes';
import type {
  AssistantAgentEvent,
  AssistantThread,
} from '@/assistant/types/assistant.types';
import { TextInput } from '@/ui/input/components/TextInput';
import styled from '@emotion/styled';

import { displayThreadName } from './AssistantPage';
import { McpClientChat } from './McpClientChat';

const StyledChatPanel = styled.div<{ isMobile: boolean }>`
  display: flex;
  flex-direction: column;
  ${({ isMobile }) =>
    isMobile
      ? 'min-height: 40%; max-height: 60%; min-width: 0;'
      : 'flex: 0 0 420px; min-width: 420px; max-width: 480px; flex-shrink: 0;'}
  border-right: ${({ isMobile, theme }) =>
    isMobile ? 'none' : `1px solid ${theme.border.color.medium}`};
  border-bottom: ${({ isMobile, theme }) =>
    isMobile ? `1px solid ${theme.border.color.medium}` : 'none'};
`;

const StyledThreadSelector = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(3, 4)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
  flex-shrink: 0;
  background: ${({ theme }) => theme.background.primary};
`;

const StyledThreadSelectRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledThreadSelect = styled.select`
  flex: 1;
  min-width: 0;
  padding: ${({ theme }) => theme.spacing(1, 2)};
  font-size: ${({ theme }) => theme.font.size.sm};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  transition: border-color 0.2s ease-in-out;

  &:hover {
    border-color: ${({ theme }) => theme.border.color.strong};
  }

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.color.blue};
  }
`;

const StyledThreadNameInput = styled(TextInput)`
  font-size: ${({ theme }) => theme.font.size.sm};
`;

type AssistantChatColumnProps = {
  isMobile: boolean;
  agentEvents: AssistantAgentEvent[];
  threads: AssistantThread[];
  currentThread: AssistantThread | null;
  currentThreadId: string;
  threadsLoading: boolean;
  threadsLoadedFromBackend: boolean;
  editingThreadName: boolean;
  onSelectThread: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  onThreadNameChange: (name: string) => void;
  onThreadNameFocusChange: (isEditing: boolean) => void;
  onMessagesChange: (messages: AssistantThread['messages']) => void;
  onTableData: (data: NonNullable<AssistantThread['lastTableData']>) => void;
  onMessageComplete: () => void;
  onAgentEvent: (event: AssistantAgentEvent) => void;
};

export const AssistantChatColumn = ({
  isMobile,
  agentEvents,
  threads,
  currentThread,
  currentThreadId,
  threadsLoading,
  threadsLoadedFromBackend,
  editingThreadName,
  onSelectThread,
  onThreadNameChange,
  onThreadNameFocusChange,
  onMessagesChange,
  onTableData,
  onMessageComplete,
  onAgentEvent,
}: AssistantChatColumnProps) => {
  return (
    <StyledChatPanel isMobile={isMobile}>
      <AssistantActivityFeed events={agentEvents} />
      <AssistantThreadNotes agentNotes={currentThread?.agentNotes} />
      <StyledThreadSelector aria-busy={threadsLoading}>
        {isMobile && (
          <StyledThreadSelectRow>
            <StyledThreadSelect
              value={
                threads.some((t) => t.id === currentThreadId)
                  ? currentThreadId
                  : threads[0]?.id ?? '__new__'
              }
              onChange={onSelectThread}
              aria-label="Select conversation thread"
              disabled={threadsLoading}
            >
              {threads.map((t) => (
                <option key={t.id} value={t.id}>
                  {displayThreadName(t.name)}
                </option>
              ))}
            </StyledThreadSelect>
          </StyledThreadSelectRow>
        )}
        {currentThread && (
          <StyledThreadNameInput
            value={displayThreadName(currentThread.name)}
            onChange={(value: string) => onThreadNameChange(value)}
            placeholder="Thread name"
            onBlur={() => onThreadNameFocusChange(false)}
            onFocus={() => onThreadNameFocusChange(true)}
            fullWidth
          />
        )}
      </StyledThreadSelector>
      {currentThread && (
        <McpClientChat
          messages={currentThread.messages}
          onMessagesChange={onMessagesChange}
          onTableData={onTableData}
          threadId={currentThreadId || undefined}
          onThreadNameChange={onThreadNameChange}
          onMessageComplete={onMessageComplete}
          onAgentEvent={onAgentEvent}
        />
      )}
    </StyledChatPanel>
  );
};

