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

import { parseServerSentEvent } from '../utils/serverSentEvents';
import { AssistantJDSection } from './AssistantJDSection';
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

type DemoStreamRequestBody = {
  requirement: string;
  threadId: string;
  threadName: string;
  maxTurns: number;
};

function fetchDemoStream(
  baseUrl: string,
  token: string,
  body: DemoStreamRequestBody,
  signal: AbortSignal,
): Promise<Response> {
  return fetch(`${baseUrl}/autonomous-recruiter/demo-thread/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal,
  });
}

function fallbackDemoThread(
  baseUrl: string,
  token: string,
  body: DemoStreamRequestBody,
): Promise<void> {
  return fetch(`${baseUrl}/autonomous-recruiter/demo-thread`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  }).then(() => {}, () => {});
}

function finishDemoRun(
  setIsDemoRunning: (value: boolean) => void,
  abortControllerRef: React.MutableRefObject<AbortController | null>,
): void {
  setIsDemoRunning(false);
  abortControllerRef.current = null;
}

type ChatMessage = AssistantThread['messages'][number];

function getMessagesWithStreamingDelta(
  prevMessages: ChatMessage[],
  streamingIndex: number,
  fullText: string,
): { nextMessages: ChatMessage[]; nextIndex: number } {
  const nextMessages = [...prevMessages];
  const assistantBubble: ChatMessage = {
    role: 'assistant',
    content: fullText,
  };

  if (streamingIndex >= 0 && streamingIndex < nextMessages.length) {
    const existing = nextMessages[streamingIndex];
    if (existing?.role === 'assistant') {
      nextMessages[streamingIndex] = { ...existing, content: fullText };
      return { nextMessages, nextIndex: streamingIndex };
    }
  }

  nextMessages.push(assistantBubble);
  return { nextMessages, nextIndex: nextMessages.length - 1 };
}

const PLANNING_PREFIX = 'Planning next step: ';

type DemoStreamContext = {
  demoStreamingTextRef: React.MutableRefObject<string>;
  demoStreamingMessagesRef: React.MutableRefObject<ChatMessage[]>;
  demoStreamingMessageIndexRef: React.MutableRefObject<number>;
  demoPlannerTextRef: React.MutableRefObject<string>;
  demoPlannerMessageIndexRef: React.MutableRefObject<number>;
  currentThreadId: string;
  onMessagesChange: (messages: ChatMessage[]) => void;
  onAgentEvent: (event: AssistantAgentEvent) => void;
  onMessageComplete: () => void;
  handleStopDemoRun: () => void;
};

function handleDemoStreamEvent(
  eventType: string,
  dataStr: string,
  ctx: DemoStreamContext,
): void {
  if (eventType === 'planner_text') {
    try {
      const data = JSON.parse(dataStr) as { delta?: string };
      if (typeof data.delta !== 'string' || !data.delta) return;
      ctx.demoPlannerTextRef.current += data.delta;
      const prevMessages = ctx.demoStreamingMessagesRef.current;
      const plannerIndex = ctx.demoPlannerMessageIndexRef.current;
      const content = PLANNING_PREFIX + ctx.demoPlannerTextRef.current;
      const nextMessages = [...prevMessages];
      const plannerBubble: ChatMessage = { role: 'assistant', content };
      if (plannerIndex >= 0 && plannerIndex < nextMessages.length) {
        nextMessages[plannerIndex] = plannerBubble;
      } else {
        nextMessages.push(plannerBubble);
        ctx.demoPlannerMessageIndexRef.current = nextMessages.length - 1;
      }
      ctx.demoStreamingMessagesRef.current = nextMessages;
      ctx.onMessagesChange(nextMessages);
    } catch {
      // Ignore malformed JSON in stream
    }
    return;
  }

  if (eventType === 'text') {
    try {
      const data = JSON.parse(dataStr) as { delta?: string };
      if (typeof data.delta !== 'string' || !data.delta) return;
      ctx.demoStreamingTextRef.current += data.delta;
      const prevMessages = ctx.demoStreamingMessagesRef.current;
      const streamingIndex = ctx.demoStreamingMessageIndexRef.current;
      const { nextMessages, nextIndex } = getMessagesWithStreamingDelta(
        prevMessages,
        streamingIndex,
        ctx.demoStreamingTextRef.current,
      );
      ctx.demoStreamingMessagesRef.current = nextMessages;
      ctx.demoStreamingMessageIndexRef.current = nextIndex;
      ctx.onMessagesChange(nextMessages);
    } catch {
      // Ignore malformed JSON in stream
    }
    return;
  }

  if (eventType === 'status') {
    try {
      const data = JSON.parse(dataStr) as { message?: string };
      if (typeof data.message !== 'string' || !data.message) return;
      const prevMessages = ctx.demoStreamingMessagesRef.current;
      const nextMessages = [
        ...prevMessages,
        { role: 'assistant' as const, content: data.message },
      ];
      ctx.demoStreamingMessagesRef.current = nextMessages;
      ctx.onMessagesChange(nextMessages);
    } catch {
      // Ignore malformed JSON in stream
    }
    return;
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
      if (!displayText) return;
      const prevMessages = ctx.demoStreamingMessagesRef.current;
      const nextMessages = [
        ...prevMessages,
        { role: 'assistant' as const, content: displayText },
      ];
      ctx.demoStreamingMessagesRef.current = nextMessages;
      ctx.onMessagesChange(nextMessages);
    } catch {
      // Ignore malformed JSON in stream
    }
    return;
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
      ctx.onAgentEvent({
        status: eventType === 'done' ? 'completed' : 'tool_call',
        threadId: ctx.currentThreadId,
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
      // Ignore malformed JSON in stream
    }
    ctx.onMessageComplete();
    if (eventType === 'done') {
      ctx.handleStopDemoRun();
    }
  }
}

async function processDemoStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  ctx: DemoStreamContext,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const raw of events) {
      const parsed = parseServerSentEvent(raw);
      if (!parsed) continue;
      handleDemoStreamEvent(parsed.eventType, parsed.dataStr, ctx);
    }
  }
}

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
  const { objectMetadataItems } = useObjectMetadataItems();
  const hasJobObjectMetadata = objectMetadataItems.some(
    (item) => item.nameSingular === 'job',
  );

  const tokenPair = useRecoilValue(tokenPairState);
  const token = tokenPair?.accessToken?.token;

  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const [isHeartbeatSending, setIsHeartbeatSending] = useState(false);
  const demoAbortControllerRef = useRef<AbortController | null>(null);
  const demoStreamingTextRef = useRef<string>('');
  const demoStreamingMessagesRef = useRef<AssistantThread['messages']>([]);
  const demoStreamingMessageIndexRef = useRef<number>(-1);
  const demoPlannerTextRef = useRef<string>('');
  const demoPlannerMessageIndexRef = useRef<number>(-1);

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
    demoPlannerTextRef.current = '';
    demoPlannerMessageIndexRef.current = -1;
  }, []);

  const handleStartMockRun = useCallback(async () => {
    if (isDemoRunning) {
      handleStopDemoRun();
      return;
    }

    if (!currentThread || !currentThreadId) return;
    if (!baseUrl || !token || !threadsLoadedFromBackend) return;

    try {
      const abortController = new AbortController();
      demoAbortControllerRef.current = abortController;
      setIsDemoRunning(true);

      const response = await fetchDemoStream(baseUrl, token, {
        requirement: 'Hi.',
        threadId: currentThreadId,
        threadName: currentThread.name,
        maxTurns: 10,
      }, abortController.signal);

      if (!response.ok) {
        await fallbackDemoThread(baseUrl, token, {
          requirement: 'Hi.',
          threadId: currentThreadId,
          threadName: currentThread.name,
          maxTurns: 10,
        });
        finishDemoRun(setIsDemoRunning, demoAbortControllerRef);
        onMessageComplete();
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        finishDemoRun(setIsDemoRunning, demoAbortControllerRef);
        onMessageComplete();
        return;
      }

      demoStreamingTextRef.current = '';
      demoStreamingMessagesRef.current = currentThread.messages ?? [];
      demoStreamingMessageIndexRef.current = -1;
      demoPlannerTextRef.current = '';
      demoPlannerMessageIndexRef.current = -1;

      await processDemoStream(reader, {
        demoStreamingTextRef,
        demoStreamingMessagesRef,
        demoStreamingMessageIndexRef,
        demoPlannerTextRef,
        demoPlannerMessageIndexRef,
        currentThreadId,
        onMessagesChange,
        onAgentEvent,
        onMessageComplete,
        handleStopDemoRun,
      });

      finishDemoRun(setIsDemoRunning, demoAbortControllerRef);
    } catch {
      finishDemoRun(setIsDemoRunning, demoAbortControllerRef);
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
    onMessagesChange,
  ]);

  const handleSendHeartbeat = useCallback(async () => {
    if (!baseUrl || !token) {
      return;
    }

    try {
      setIsHeartbeatSending(true);
      await fetch(`${baseUrl}/autonomous-recruiter/heartbeat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // Best-effort fire-and-forget; surface errors later via agent events
    } finally {
      setIsHeartbeatSending(false);
    }
  }, [baseUrl, token]);

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
                <StyledJDMenuContainer>
                  <StyledJDMenuButton
                    type="button"
                    onClick={handleSendHeartbeat}
                    title="Send autonomous recruiter heartbeat"
                    disabled={threadsLoading || isHeartbeatSending}
                  >
                    {isHeartbeatSending ? 'Sending…' : 'Send heartbeat'}
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

