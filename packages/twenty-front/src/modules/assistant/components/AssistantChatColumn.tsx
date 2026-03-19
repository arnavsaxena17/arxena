import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { AssistantThreadNotes } from '@/assistant/components/AssistantThreadNotes';
import type {
  AssistantAgentEvent,
  AssistantThread,
  LinkedInSearchType,
} from '@/assistant/types/assistant.types';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { TextInput } from '@/ui/input/components/TextInput';
import styled from '@emotion/styled';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { IconDotsVertical, IconFile, IconX } from 'twenty-ui';

import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';

import { parseServerSentEvent } from '../utils/serverSentEvents';
import { AssistantJDSection } from './AssistantJDSection';
import { displayThreadName } from './AssistantThreadUtils';
import { McpClientChat } from './McpClientChat';

const baseUrl = process.env.REACT_APP_SERVER_BASE_URL ?? '';

const StyledChatPanel = styled.div<{ isMobile: boolean }>`
  display: flex;
  flex-direction: column;
  overflow: hidden;
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

const StyledThreadHeaderRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledThreadMenuContainer = styled.div`
  position: relative;
  display: inline-flex;
`;

const StyledThreadMenuButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(0.75)};
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

const StyledThreadMenuDropdown = styled.div`
  position: absolute;
  top: calc(100% + ${({ theme }) => theme.spacing(1)});
  right: 0;
  min-width: 220px;
  background-color: ${({ theme }) => theme.background.primary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  z-index: 1000;
`;

const StyledThreadMenuAction = styled.button`
  width: 100%;
  padding: ${({ theme }) => theme.spacing(1.5)} ${({ theme }) => theme.spacing(2)};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing(1)};
  border: none;
  background: transparent;
  text-align: left;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
  cursor: pointer;

  &:hover {
    background-color: ${({ theme }) => theme.background.secondary};
  }
`;

const StyledThreadMenuDangerAction = styled(StyledThreadMenuAction)`
  color: ${({ theme }) => theme.font.color.tertiary};

  &:hover {
    background-color: ${({ theme }) => theme.background.tertiary};
    color: ${({ theme }) => theme.font.color.secondary};
  }
`;

const StyledThreadMenuSectionTitle = styled.div`
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.tertiary};
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const StyledThreadMenuActionActive = styled(StyledThreadMenuAction)<{ active?: boolean }>`
  background-color: ${({ theme, active }) =>
    active ? theme.background.transparent.light : 'transparent'};
`;

const SEARCH_TYPE_OPTIONS: { value: LinkedInSearchType; label: string }[] = [
  { value: 'classic', label: 'Classic' },
  { value: 'sales_navigator', label: 'Sales Navigator' },
  { value: 'recruiter', label: 'Recruiter' },
];

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

const StyledJobAttachedRow = styled.div`
  margin-top: ${({ theme }) => theme.spacing(1)};
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.secondary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledJobAttachedRowContent = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  min-width: 0;
`;

const StyledJobAttachedText = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledJDAttachedIndicator = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  padding: ${({ theme }) => theme.spacing(0.25)};
  cursor: pointer;
  color: ${({ theme }) => theme.font.color.secondary};

  &:hover {
    background: ${({ theme }) => theme.background.tertiary};
  }
`;

const StyledJDRemoveButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  padding: ${({ theme }) => theme.spacing(0.25)};
  border-radius: ${({ theme }) => theme.border.radius.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.background.tertiary};
    color: ${({ theme }) => theme.font.color.secondary};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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
  onDeleteThread: (threadId: string) => Promise<void> | void;
  onPatchThread: (
    threadId: string,
    patch: {
      assistantMode?: 'fully_autonomous' | 'permissioned';
      jobId?: string | null;
      name?: string;
      searchType?: LinkedInSearchType;
    },
  ) => Promise<void> | void;
  onUpdateThreadMode: (
    threadId: string,
    assistantMode: 'fully_autonomous' | 'permissioned',
  ) => void;
  selectedCandidateIds?: string[];
  onJobAttached?: (jobId: string) => void;
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
  onDeleteThread,
  onPatchThread,
  onUpdateThreadMode,
  selectedCandidateIds,
  onJobAttached,
}: AssistantChatColumnProps) => {
  const { objectMetadataItems } = useObjectMetadataItems();
  const parsedJD = useRecoilValue(parsedJDSelector);
  const hasJobObjectMetadata = objectMetadataItems.some(
    (item) => item.nameSingular === 'job',
  );

  const tokenPair = useRecoilValue(tokenPairState);
  const token = tokenPair?.accessToken?.token;

  const [isDemoRunning, setIsDemoRunning] = useState(false);
  const [isHeartbeatSending, setIsHeartbeatSending] = useState(false);
  const [isThreadMenuOpen, setIsThreadMenuOpen] = useState(false);
  const [isDeleteThreadModalOpen, setIsDeleteThreadModalOpen] = useState(false);
  const [isDeleteThreadLoading, setIsDeleteThreadLoading] = useState(false);
  const [threadIdToDelete, setThreadIdToDelete] = useState<string | null>(null);
  const [jdActions, setJdActions] = useState<{
    openFilePicker: () => void;
    openJDViewer: () => void;
    removeJD: () => Promise<void>;
    canRemoveJD: boolean;
    hasJDFile: boolean;
    uploadLabel: string;
  } | null>(null);
  const threadMenuRef = useRef<HTMLDivElement | null>(null);
  const demoAbortControllerRef = useRef<AbortController | null>(null);
  const demoStreamingTextRef = useRef<string>('');
  const demoStreamingMessagesRef = useRef<AssistantThread['messages']>([]);
  const demoStreamingMessageIndexRef = useRef<number>(-1);
  const demoPlannerTextRef = useRef<string>('');
  const demoPlannerMessageIndexRef = useRef<number>(-1);

  useEffect(() => {
    if (!isThreadMenuOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const targetNode = event.target as Node | null;
      if (!targetNode) return;
      if (threadMenuRef.current?.contains(targetNode)) return;
      setIsThreadMenuOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isThreadMenuOpen]);

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
      {/* <AssistantActivityFeed events={sortedAgentEvents} /> */}
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
            <StyledThreadHeaderRow>
              <StyledThreadNameInput
                value={displayThreadName(currentThread.name)}
                onChange={(value: string) => onThreadNameChange(value)}
                placeholder="Thread name"
                onBlur={() => onThreadNameFocusChange(false)}
                onFocus={() => onThreadNameFocusChange(true)}
                fullWidth
              />
              <StyledThreadMenuContainer ref={threadMenuRef}>
                <StyledThreadMenuButton
                  type="button"
                  onClick={() => setIsThreadMenuOpen((open) => !open)}
                  title="Thread actions"
                  disabled={threadsLoading || !threadsLoadedFromBackend}
                >
                  <IconDotsVertical size={14} />
                </StyledThreadMenuButton>
                {isThreadMenuOpen && (
                  <StyledThreadMenuDropdown>
                    <StyledThreadMenuAction
                      type="button"
                      onClick={() => {
                        const assistantMode = currentThread.assistantMode ?? 'permissioned';
                        onUpdateThreadMode(
                          currentThreadId,
                          assistantMode === 'fully_autonomous'
                            ? 'permissioned'
                            : 'fully_autonomous',
                        );
                        setIsThreadMenuOpen(false);
                      }}
                    >
                      <span>
                        Switch to{' '}
                        {(currentThread.assistantMode ?? 'permissioned') ===
                        'fully_autonomous'
                          ? 'permissioned'
                          : 'autonomous'}
                      </span>
                      <span style={{ opacity: 0.7 }}>
                        {(currentThread.assistantMode ?? 'permissioned') ===
                        'fully_autonomous'
                          ? 'Perm'
                          : 'Auto'}
                      </span>
                    </StyledThreadMenuAction>
                    <StyledThreadMenuSectionTitle>
                      Search Type
                    </StyledThreadMenuSectionTitle>
                    {SEARCH_TYPE_OPTIONS.map((opt) => (
                      <StyledThreadMenuActionActive
                        key={opt.value}
                        type="button"
                        active={opt.value === (currentThread.searchType ?? 'classic')}
                        onClick={() => {
                          onPatchThread(currentThreadId, { searchType: opt.value });
                          setIsThreadMenuOpen(false);
                        }}
                      >
                        <span>{opt.label}</span>
                      </StyledThreadMenuActionActive>
                    ))}
                    {jdActions && (
                      <StyledThreadMenuAction
                        type="button"
                        onClick={() => {
                          jdActions.openFilePicker();
                          setIsThreadMenuOpen(false);
                        }}
                      >
                        <span>{jdActions.uploadLabel}</span>
                        <span style={{ opacity: 0.7 }}>JD</span>
                      </StyledThreadMenuAction>
                    )}
                    <StyledThreadMenuDangerAction
                      type="button"
                      disabled={threadsLoading || !threadsLoadedFromBackend}
                      onClick={() => {
                        if (!currentThreadId) return;

                        setIsThreadMenuOpen(false);
                        setThreadIdToDelete(currentThreadId);
                        setIsDeleteThreadModalOpen(true);
                      }}
                    >
                      <span>Delete thread</span>
                      <span style={{ opacity: 0.7 }}>Del</span>
                    </StyledThreadMenuDangerAction>
                  </StyledThreadMenuDropdown>
                )}
              </StyledThreadMenuContainer>
            </StyledThreadHeaderRow>
            <StyledJobAttachedRow title={currentThread.jobId ?? undefined}>
              <StyledJobAttachedRowContent>
                <StyledJobAttachedText>
                  {(() => {
                    const hasParsedJD = Boolean(parsedJD?.name || parsedJD?.jobCode);
                    const hasThreadJobDetails = Boolean(
                      currentThread.jobId && (currentThread.job?.name || currentThread.job?.id),
                    );
                    const hasThreadJobIdOnly = Boolean(currentThread.jobId && !currentThread.job);

                    if (hasParsedJD) {
                      return (
                        <>
                          Job{' '}
                          {parsedJD?.jobCode && parsedJD?.name
                            ? `${parsedJD.jobCode} - ${parsedJD.name}`
                            : parsedJD?.name ?? 'Job Description'}
                        </>
                      );
                    }

                    if (hasThreadJobDetails) {
                      return (
                        <>
                          Job: {currentThread.job?.name ?? currentThread.job?.id}
                          {currentThread.job?.company?.name
                            ? ` at ${currentThread.job.company.name}`
                            : ''}
                        </>
                      );
                    }

                    if (hasThreadJobIdOnly) {
                      return <>Job attached</>;
                    }

                    return <>No job attached</>;
                  })()}
                </StyledJobAttachedText>
                {Boolean(currentThread.jobId && jdActions?.hasJDFile) && (
                  <>
                    <StyledJDAttachedIndicator
                      type="button"
                      data-testid="assistant-jd-attached-indicator"
                      title="Open job description"
                      onClick={() => jdActions?.openJDViewer()}
                    >
                      <IconFile size={14} />
                    </StyledJDAttachedIndicator>
                    <StyledJDRemoveButton
                      type="button"
                      data-testid="assistant-jd-remove-button"
                      title="Remove JD attachment"
                      onClick={async () => {
                        await jdActions?.removeJD();
                      }}
                      disabled={!jdActions?.canRemoveJD}
                    >
                      <IconX size={14} />
                    </StyledJDRemoveButton>
                  </>
                )}
              </StyledJobAttachedRowContent>
            </StyledJobAttachedRow>
            {hasJobObjectMetadata && (
              <AssistantJDSection
                threadId={currentThreadId}
                jobId={currentThread.jobId}
                threadJobName={currentThread.job?.name ?? null}
                onAttachJobToThread={async (jobId) => {
                  await onPatchThread(currentThreadId, { jobId });
                }}
                hideMenu
                exposeActions={setJdActions}
              />
            )}
            {/* {(USE_MOCK_ASSISTANT || (baseUrl && token)) && (
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
            )} */}
          </>
        )}
      </StyledThreadSelector>
      {currentThread && (
        <McpClientChat
          key={currentThread.id}
          messages={currentThread.messages}
          onMessagesChange={onMessagesChange}
          onTableData={onTableData}
          threadId={threadsLoadedFromBackend ? currentThreadId || undefined : undefined}
          onThreadNameChange={onThreadNameChange}
          onMessageComplete={onMessageComplete}
          onAgentEvent={onAgentEvent}
          onJobAttached={onJobAttached}
          selectedCandidateIds={selectedCandidateIds}
        />
      )}

      {isDeleteThreadModalOpen && (
        <ConfirmationModal
          isOpen={isDeleteThreadModalOpen}
          setIsOpen={(val) => {
            setIsDeleteThreadModalOpen(val);
            if (!val) setThreadIdToDelete(null);
          }}
          title="Delete thread"
          subtitle="This action cannot be undone."
          onConfirmClick={() => {
            if (!threadIdToDelete) return;

            setIsDeleteThreadLoading(true);
            void Promise.resolve(onDeleteThread(threadIdToDelete))
              .catch(() => {
                // best-effort; parent is responsible for state updates
              })
              .finally(() => {
                setIsDeleteThreadLoading(false);
              });
          }}
          deleteButtonText="Delete thread"
          loading={isDeleteThreadLoading}
        />
      )}
    </StyledChatPanel>
  );
};

