import { useArxJDUpload } from '@/arx-jd-upload/hooks/useArxJDUpload';
import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { ParsedJD } from '@/arx-jd-upload/types/ParsedJD';
import { AssistantActivityFeed } from '@/assistant/components/AssistantActivityFeed';
import { AssistantThreadNotes } from '@/assistant/components/AssistantThreadNotes';
import { USE_MOCK_ASSISTANT } from '@/assistant/mocks/mockThreads';
import type {
  AssistantAgentEvent,
  AssistantThread,
} from '@/assistant/types/assistant.types';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { TextInput } from '@/ui/input/components/TextInput';
import styled from '@emotion/styled';
import { useCallback, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { IconDotsVertical, IconTrash, IconUpload } from 'twenty-ui';

import { displayThreadName } from './AssistantThreadUtils';
import { McpClientChat } from './McpClientChat';

const baseUrl = process.env.REACT_APP_SERVER_BASE_URL ?? '';

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

const StyledJDHeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-top: ${({ theme }) => theme.spacing(1)};
`;

const StyledJDSummary = styled.div`
  flex: 1;
  min-width: 0;
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.secondary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledJDMenuContainer = styled.div`
  position: relative;
  display: inline-flex;
`;

const StyledJDMenuButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(0.5, 1)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.secondary};
  cursor: pointer;
  transition: all 0.15s ease-in-out;

  &:hover {
    background-color: ${({ theme }) => theme.background.secondary};
    border-color: ${({ theme }) => theme.border.color.strong};
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledJDMenuDropdown = styled.div`
  position: absolute;
  top: calc(100% + ${({ theme }) => theme.spacing(1)});
  right: 0;
  min-width: 200px;
  background-color: ${({ theme }) => theme.background.primary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  z-index: 1000;
`;

const StyledJDMenuAction = styled.button<{ danger?: boolean }>`
  width: 100%;
  padding: ${({ theme }) => theme.spacing(1.5)} ${({ theme }) => theme.spacing(2)};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  border: none;
  background: transparent;
  text-align: left;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme, danger }) =>
    danger ? theme.color.red : theme.font.color.primary};
  cursor: pointer;

  &:hover {
    background-color: ${({ theme }) => theme.background.secondary};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
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

const AssistantJDSection = () => {
  const [isJDMenuOpen, setIsJDMenuOpen] = useState(false);
  const jdMenuRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const parsedJD: ParsedJD | null = useRecoilValue(parsedJDSelector);

  const { handleFileUpload, handleFileRemoval, isUploading } =
    useArxJDUpload('job');

  const hasJD = Boolean(parsedJD?.id);

  const getJDDisplayName = useCallback(() => {
    if (!parsedJD) return null;
    const base =
      parsedJD.jobCode && parsedJD.name
        ? `${parsedJD.jobCode} - ${parsedJD.name}`
        : parsedJD.name || 'Job Description';
    return base.length > 40 ? `${base.slice(0, 37)}...` : base;
  }, [parsedJD]);

  const handleJDReplaceClick = () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';
    fileInputRef.current.click();
  };

  const handleFileInputChange: React.ChangeEventHandler<HTMLInputElement> = async (
    event,
  ) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    await handleFileUpload(files);
  };

  if (!parsedJD && !isUploading) {
    return null;
  }

  return (
    <>
      <StyledJDHeaderRow>
        <StyledJDSummary>
          {isUploading
            ? 'Uploading job description...'
            : `JD attached: ${getJDDisplayName()}`}
        </StyledJDSummary>
        <StyledJDMenuContainer ref={jdMenuRef}>
          <StyledJDMenuButton
            type="button"
            onClick={() => setIsJDMenuOpen((open) => !open)}
            title="Job description actions"
          >
            <IconDotsVertical size={14} />
          </StyledJDMenuButton>
          {isJDMenuOpen && (
            <StyledJDMenuDropdown>
              <StyledJDMenuAction
                type="button"
                onClick={handleJDReplaceClick}
                disabled={isUploading}
              >
                <IconUpload size={14} />
                Replace JD
              </StyledJDMenuAction>
              {hasJD && (
                <StyledJDMenuAction
                  type="button"
                  danger
                  onClick={async () => {
                    await handleFileRemoval();
                    setIsJDMenuOpen(false);
                  }}
                  disabled={isUploading}
                >
                  <IconTrash size={14} />
                  Remove JD
                </StyledJDMenuAction>
              )}
            </StyledJDMenuDropdown>
          )}
        </StyledJDMenuContainer>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt"
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />
      </StyledJDHeaderRow>
    </>
  );
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
  const { objectMetadataItems } = useObjectMetadataItems();
  const hasJobObjectMetadata = objectMetadataItems.some(
    (item) => item.nameSingular === 'job',
  );

  const tokenPair = useRecoilValue(tokenPairState);
  const token = tokenPair?.accessToken?.token;

  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const demoAbortControllerRef = useRef<AbortController | null>(null);
  const demoStreamingTextRef = useRef<string>('');
  const demoStreamingMessagesRef = useRef<AssistantThread['messages']>([]);
  const demoStreamingMessageIndexRef = useRef<number>(-1);

  const handleStopDemoRun = useCallback(() => {
    const controller = demoAbortControllerRef.current;
    if (controller) {
      controller.abort();
    }
    demoAbortControllerRef.current = null;
    setIsDemoRunning(false);
    demoStreamingTextRef.current = '';
    demoStreamingMessagesRef.current = [];
    demoStreamingMessageIndexRef.current = -1;
  }, []);

  const handleStartMockRun = useCallback(async () => {
    if (isDemoRunning) {
      handleStopDemoRun();
      return;
    }

    if (!currentThread || !currentThreadId) return;
    if (!baseUrl || !token || !threadsLoadedFromBackend) return;
    const requirement =
      'We need senior React developers in Bangalore with 5+ years experience at product companies.';

    try {
      const abortController = new AbortController();
      demoAbortControllerRef.current = abortController;
      setIsDemoRunning(true);

      const response = await fetch(`${baseUrl}/autonomous-recruiter/demo-thread/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requirement,
          threadId: currentThreadId,
          threadName: currentThread.name,
          maxTurns: 10,
        }),
        signal: abortController.signal,
      });
      if (!response.ok) {
        // Best-effort: if streaming endpoint is not available, fall back to non-streaming demo call.
        await fetch(`${baseUrl}/autonomous-recruiter/demo-thread`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            requirement,
            threadId: currentThreadId,
            threadName: currentThread.name,
            maxTurns: 10
          }),
        }).catch(() => {});
        onMessageComplete();
        setIsDemoRunning(false);
        demoAbortControllerRef.current = null;
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        onMessageComplete();
        setIsDemoRunning(false);
        demoAbortControllerRef.current = null;
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      demoStreamingTextRef.current = '';
      demoStreamingMessagesRef.current = currentThread.messages ?? [];
      demoStreamingMessageIndexRef.current = -1;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        for (const raw of events) {
          let eventType = 'message';
          let dataStr = '';
          for (const line of raw.split('\n')) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim();
            if (line.startsWith('data: ')) dataStr = line.slice(6);
          }
          if (!dataStr) continue;

          if (eventType === 'text') {
            try {
              const data = JSON.parse(dataStr) as { delta?: string };
              if (typeof data.delta === 'string' && data.delta) {
                demoStreamingTextRef.current += data.delta;

                // Update streaming assistant bubble in the main chat
                const prevMessages = demoStreamingMessagesRef.current;
                const nextMessages = [...prevMessages];
                const streamingIndex = demoStreamingMessageIndexRef.current;

                if (streamingIndex >= 0 && streamingIndex < nextMessages.length) {
                  const existing = nextMessages[streamingIndex];
                  if (existing?.role === 'assistant') {
                    nextMessages[streamingIndex] = {
                      ...existing,
                      content: demoStreamingTextRef.current,
                    };
                  } else {
                    nextMessages.push({
                      role: 'assistant',
                      content: demoStreamingTextRef.current,
                    });
                    demoStreamingMessageIndexRef.current = nextMessages.length - 1;
                  }
                } else {
                  nextMessages.push({
                    role: 'assistant',
                    content: demoStreamingTextRef.current,
                  });
                  demoStreamingMessageIndexRef.current = nextMessages.length - 1;
                }

                demoStreamingMessagesRef.current = nextMessages;
                onMessagesChange(nextMessages);
              }
            } catch {
              // Ignore malformed JSON in stream; proceed to next event.
            }
          }

          if (eventType === 'status') {
            try {
              const data = JSON.parse(dataStr) as { message?: string };
              if (typeof data.message === 'string' && data.message) {
                const prevMessages = demoStreamingMessagesRef.current;
                const nextMessages = [
                  ...prevMessages,
                  {
                    role: 'assistant' as const,
                    content: data.message,
                  },
                ];
                demoStreamingMessagesRef.current = nextMessages;
                onMessagesChange(nextMessages);
              }
            } catch {
              // Ignore malformed JSON in stream; proceed to next event.
            }
          }

          if (eventType === 'message') {
            try {
              const payload = JSON.parse(dataStr) as {
                type?: string;
                data?: unknown;
                chatMessage?: string;
              };

              const msgType = typeof payload.type === 'string' ? payload.type : '';
              const chatMessage =
                typeof payload.chatMessage === 'string' ? payload.chatMessage : null;

              const displayText =
                chatMessage ??
                (msgType
                  ? `**${msgType}**\n${
                      typeof payload.data !== 'undefined'
                        ? JSON.stringify(payload.data, null, 2)
                        : ''
                    }`
                  : '');

              if (displayText) {
                const prevMessages = demoStreamingMessagesRef.current;
                const nextMessages = [
                  ...prevMessages,
                  {
                    role: 'assistant' as const,
                    content: displayText,
                  },
                ];
                demoStreamingMessagesRef.current = nextMessages;
                onMessagesChange(nextMessages);
              }
            } catch {
              // Ignore malformed JSON in stream; proceed to next event.
            }
          }

          if (eventType === 'step' || eventType === 'done') {
            try {
              const payload = JSON.parse(dataStr) as {
                step?: number;
                recruiterInstruction?: string;
                autonomousResponse?: string;
              };

              const stepNumber = payload.step ?? undefined;
              const summaryBase =
                typeof payload.recruiterInstruction === 'string'
                  ? payload.recruiterInstruction
                  : payload.autonomousResponse ?? '';

              const summaryText =
                summaryBase.length > 160
                  ? `${summaryBase.slice(0, 157)}...`
                  : summaryBase;

              onAgentEvent({
                status: eventType === 'done' ? 'completed' : 'tool_call',
                threadId: currentThreadId,
                runId: stepNumber ? `demo-step-${stepNumber}` : undefined,
                summary:
                  eventType === 'done'
                    ? summaryText || 'Autonomous recruiter demo finished'
                    : summaryText ||
                      (stepNumber
                        ? `Autonomous recruiter demo step ${stepNumber}`
                        : 'Autonomous recruiter demo step'),
                timestamp: Date.now(),
              });
            } catch {
              // Ignore malformed JSON in stream; still refresh messages below.
            }

            // Each step completion (and final done) means the backend has appended
            // new messages to the thread; refresh from the server so the chat updates.
            onMessageComplete();
            if (eventType === 'done') {
              handleStopDemoRun();
            }
          }
        }
      }
      setIsDemoRunning(false);
      demoAbortControllerRef.current = null;
    } catch {
      // If anything goes wrong talking to the backend, silently fail for now
      setIsDemoRunning(false);
      demoAbortControllerRef.current = null;
    }
  }, [
    baseUrl,
    token,
    threadsLoadedFromBackend,
    currentThread,
    currentThreadId,
    isDemoRunning,
    handleStopDemoRun,
    onMessageComplete,
    onAgentEvent,
  ]);

  const sortedAgentEvents = [...agentEvents].sort(
    (a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0),
  );

  return (
    <StyledChatPanel
      isMobile={isMobile}
    >
      <AssistantActivityFeed events={sortedAgentEvents} />
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
          <>
            <StyledThreadNameInput
              value={displayThreadName(currentThread.name)}
              onChange={(value: string) => onThreadNameChange(value)}
              placeholder="Thread name"
              onBlur={() => onThreadNameFocusChange(false)}
              onFocus={() => onThreadNameFocusChange(true)}
              fullWidth
            />
            {hasJobObjectMetadata && <AssistantJDSection />}
            {(USE_MOCK_ASSISTANT || (baseUrl && token)) && (
              <StyledJDHeaderRow>
                <StyledJDSummary>
                  Recruiter + autonomous recruiter demo
                </StyledJDSummary>
                <StyledJDMenuContainer>
                  <StyledJDMenuButton
                    type="button"
                    onClick={handleStartMockRun}
                    title={
                      isDemoRunning
                        ? 'Stop recruiter/autonomous mock run'
                        : 'Start recruiter/autonomous mock run'
                    }
                    disabled={threadsLoading}
                  >
                    {isDemoRunning ? 'Stop demo' : 'Start demo'}
                  </StyledJDMenuButton>
                </StyledJDMenuContainer>
              </StyledJDHeaderRow>
            )}
          </>
        )}
      </StyledThreadSelector>
      {currentThread && (
        <McpClientChat
          messages={currentThread.messages}
          onMessagesChange={onMessagesChange}
          onTableData={onTableData}
          threadId={threadsLoadedFromBackend ? currentThreadId || undefined : undefined}
          onThreadNameChange={onThreadNameChange}
          onMessageComplete={onMessageComplete}
          onAgentEvent={onAgentEvent}
        />
      )}
    </StyledChatPanel>
  );
};

