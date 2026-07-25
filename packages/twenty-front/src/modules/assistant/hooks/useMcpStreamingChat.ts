import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  AssistantAgentEvent,
  AssistantChatMessage,
  AssistantStatusMessagePolicy,
} from '@/assistant/types/assistant.types';

import type { AssistantTableData } from '../components/AssistantDetailsTable';
import { parseServerSentEvent } from '../utils/serverSentEvents';

type UseMcpStreamingChatParams = {
  messages: AssistantChatMessage[];
  setMessages: (
    updater:
      | AssistantChatMessage[]
      | ((prev: AssistantChatMessage[]) => AssistantChatMessage[]),
  ) => void;
  threadId?: string;
  onTableData?: (data: AssistantTableData) => void;
  onThreadNameChange?: (name: string) => void;
  onMessageComplete?: () => void;
  onStreamMessage?: (type: string, data: unknown) => void;
  onAgentEvent?: (event: AssistantAgentEvent) => void;
  onJobAttached?: (projectId: string) => void;
  token?: string;
  baseUrl: string;
  /** Candidate IDs selected in the results DataTable; forwarded to the backend on each request */
  selectedCandidateIds?: string[];
  statusMessagePolicy?: Partial<AssistantStatusMessagePolicy>;
};

const DEFAULT_STATUS_MESSAGE_POLICY: AssistantStatusMessagePolicy = {
  persistToThread: true,
  showInUi: true,
  includeInConversationHistory: true,
};

const stripThreadNameQuotes = (name: string): string => {
  const t = name.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    return t.slice(1, -1).trim();
  }
  return t;
};

const buildConversationHistory = (
  historyMessages: AssistantChatMessage[],
  statusMessagePolicy?: Partial<AssistantStatusMessagePolicy>,
) =>
  historyMessages.flatMap((message, messageIndex) => {
    const effectiveStatusMessagePolicy = {
      ...DEFAULT_STATUS_MESSAGE_POLICY,
      ...(statusMessagePolicy ?? {}),
    };

    if (
      message.isStatus &&
      !effectiveStatusMessagePolicy.includeInConversationHistory
    ) {
      return [];
    }

    if (message.role === 'user') {
      return [{ role: 'user' as const, content: message.content }];
    }

    const assistantContent = [
      ...(message.content
        ? [{ type: 'text' as const, text: message.content }]
        : []),
      ...((message.toolCalls ?? []).map((toolCall, toolIndex) => ({
        type: 'tool_use' as const,
        id: `tc-${messageIndex}-${toolIndex}`,
        name: toolCall.name,
        input: toolCall.args ?? {},
      }))),
    ];

    const history: Array<{
      role: 'user' | 'assistant';
      content: string | Array<unknown>;
    }> = [];

    if (assistantContent.length > 0) {
      history.push({
        role: 'assistant',
        content: assistantContent,
      });
    }

    const toolResults = (message.toolResults ?? []).map((toolResult, toolIndex) => ({
      type: 'tool_result' as const,
      tool_use_id: `tc-${messageIndex}-${toolIndex}`,
      content: toolResult.content,
    }));

    if (toolResults.length > 0) {
      history.push({
        role: 'user',
        content: toolResults,
      });
    }

    return history;
  });

const mergeTableColumns = (
  currentColumns: string[],
  incomingColumns: string[],
): string[] => {
  const mergedColumns = [...currentColumns];

  for (const column of incomingColumns) {
    if (!mergedColumns.includes(column)) {
      mergedColumns.push(column);
    }
  }

  return mergedColumns;
};

export const useMcpStreamingChat = ({
  messages,
  setMessages,
  threadId,
  onTableData,
  onThreadNameChange,
  onMessageComplete,
  onStreamMessage,
  onAgentEvent,
  onJobAttached,
  token,
  baseUrl,
  selectedCandidateIds,
  statusMessagePolicy,
}: UseMcpStreamingChatParams) => {
  const [loading, setLoading] = useState(false);
  const [streamLog, setStreamLog] = useState<string[]>([]);
  const [streamLogMinimized, setStreamLogMinimized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamingMessageIndexRef = useRef<number>(-1);
  const accumulatedContentRef = useRef<string>('');
  const lastBubbleIsTextRunRef = useRef<boolean>(false);
  const streamedMessagesRef = useRef<AssistantChatMessage[]>(messages);
  const activeRequestControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    streamedMessagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    setStreamLog([]);
    setStreamLogMinimized(false);
  }, [threadId]);

  const initializeStreamingState = (userText: string) => {
    accumulatedContentRef.current = '';
    lastBubbleIsTextRunRef.current = false;
    const withUserMessage: AssistantChatMessage[] = [
      ...messages,
      { role: 'user' as const, content: userText },
    ];
    streamedMessagesRef.current = withUserMessage;
    setMessages(withUserMessage);
    setLoading(true);
    return withUserMessage;
  };

  const revertLastMessageAndResetStreaming = () => {
    const reverted = streamedMessagesRef.current.slice(0, -1);
    streamedMessagesRef.current = reverted;
    setMessages(reverted);
    streamingMessageIndexRef.current = -1;
    accumulatedContentRef.current = '';
    setLoading(false);
  };

  const resetStreamingRefs = () => {
    streamingMessageIndexRef.current = -1;
    accumulatedContentRef.current = '';
    lastBubbleIsTextRunRef.current = false;
    activeRequestControllerRef.current = null;
  };

  const stopMessage = useCallback(() => {
    const controller = activeRequestControllerRef.current;
    if (!controller) {
      return;
    }
    setStreamLog((prev) => [...prev, 'Stopping run...']);
    controller.abort('user_stop');
    activeRequestControllerRef.current = null;
    setLoading(false);
  }, []);

  const handleSseEvent = useCallback(
    (eventType: string, data: Record<string, unknown>) => {
      if (eventType === 'agent_event') {
        const evt = data as Partial<AssistantAgentEvent>;
        if (evt && typeof evt.status === 'string') {
          onAgentEvent?.({
            status: evt.status as AssistantAgentEvent['status'],
            threadId: evt.threadId,
            runId: evt.runId,
            summary: typeof evt.summary === 'string' ? evt.summary : undefined,
            error: typeof evt.error === 'string' ? evt.error : undefined,
            toolName:
              typeof evt.toolName === 'string' ? evt.toolName : undefined,
            timestamp:
              typeof evt.timestamp === 'number' ? evt.timestamp : Date.now(),
          });
        }
        return;
      }

      if (eventType === 'tool_use' && typeof data.name === 'string') {
        lastBubbleIsTextRunRef.current = false;
        const toolName = data.name as string;
        const next = [
          ...streamedMessagesRef.current,
          {
            role: 'assistant' as const,
            content: `Using: ${toolName}`,
          },
        ];
        streamingMessageIndexRef.current = next.length - 1;
        streamedMessagesRef.current = next;
        setMessages(next);

        onAgentEvent?.({
          status: 'tool_call',
          threadId,
          runId: undefined,
          summary: `Calling ${toolName}`,
          toolName,
          timestamp: Date.now(),
        });
        return;
      }

      if (eventType === 'status' && typeof data.message === 'string') {
        const statusText = data.message as string;

        if ((statusMessagePolicy?.showInUi ?? true) === true) {
          setStreamLog((prev) => [...prev, statusText]);
        }

        if (
          (statusMessagePolicy?.showInUi ?? true) ||
          (statusMessagePolicy?.includeInConversationHistory ?? true)
        ) {
          lastBubbleIsTextRunRef.current = false;
          const next = [
            ...streamedMessagesRef.current,
            {
              role: 'assistant' as const,
              content: statusText,
              isStatus: true,
            },
          ];
          streamingMessageIndexRef.current = next.length - 1;
          streamedMessagesRef.current = next;
          setMessages(next);
        }
        return;
      }

      if (eventType === 'message') {
        lastBubbleIsTextRunRef.current = false;
        const msgType = typeof data.type === 'string' ? data.type : '';
        if (msgType) {
          setStreamLog((prev) => [...prev, msgType]);
        }
        onStreamMessage?.(msgType, (data as { data?: unknown }).data ?? data);
        const chatMessage =
          typeof (data as { chatMessage?: unknown }).chatMessage === 'string'
            ? (data as { chatMessage?: string }).chatMessage
            : null;
        const displayText =
          chatMessage ??
          (msgType
            ? `**${msgType}**\n${
                typeof (data as { data?: unknown }).data !== 'undefined'
                  ? JSON.stringify((data as { data?: unknown }).data, null, 2)
                  : ''
              }`
            : '');
        if (displayText) {
          const next = [
            ...streamedMessagesRef.current,
            { role: 'assistant' as const, content: displayText },
          ];
          streamingMessageIndexRef.current = next.length - 1;
          streamedMessagesRef.current = next;
          setMessages(next);
        }
        return;
      }

      if (
        eventType === 'text' &&
        typeof (data as { delta?: unknown }).delta === 'string'
      ) {
        const delta = (data as { delta: string }).delta;
        const isNewTextRun = !lastBubbleIsTextRunRef.current;
        if (isNewTextRun) {
          accumulatedContentRef.current = delta;
          lastBubbleIsTextRunRef.current = true;
        } else {
          accumulatedContentRef.current += delta;
        }
        const prev = streamedMessagesRef.current;
        const next = [...prev];
        let assistantIndex = -1;
        for (let i = next.length - 1; i >= 0; i -= 1) {
          if (next[i]?.role === 'assistant') {
            assistantIndex = i;
            break;
          }
        }
        if (isNewTextRun || assistantIndex === -1) {
          next.push({
            role: 'assistant' as const,
            content: accumulatedContentRef.current,
          });
          assistantIndex = next.length - 1;
        } else {
          next[assistantIndex] = {
            ...next[assistantIndex],
            content: accumulatedContentRef.current,
          };
        }
        streamingMessageIndexRef.current = assistantIndex;
        streamedMessagesRef.current = next;
        setMessages(next);
        return;
      }

      if (eventType === 'table_data') {
        const d = data as {
          columns?: unknown;
          rows?: unknown;
          tableId?: unknown;
          tableType?: unknown;
          label?: unknown;
        };
        const columns = Array.isArray(d.columns) ? (d.columns as string[]) : [];
        const rows = Array.isArray(d.rows) ? (d.rows as unknown[]) : [];
        if (columns.length > 0 && rows.length > 0) {
          const tableData = {
            columns,
            rows: rows as Record<string, unknown>[],
            ...(typeof d.tableId === 'string' ? { tableId: d.tableId } : {}),
            ...(typeof d.tableType === 'string'
              ? { tableType: d.tableType }
              : {}),
            ...(typeof d.label === 'string' ? { label: d.label } : {}),
          };
          onTableData?.(tableData);
          const prev = streamedMessagesRef.current;
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            const list = last.tableDataList ?? [];
            const candidateTableIndex = list.findIndex(
              (item) => item.tableType === 'candidates',
            );

            if (
              (tableData.tableType === 'candidates' || candidateTableIndex >= 0) &&
              candidateTableIndex >= 0
            ) {
              const existingTable = list[candidateTableIndex];
              const mergedTable = {
                ...existingTable,
                ...tableData,
                columns: mergeTableColumns(
                  existingTable.columns,
                  tableData.columns,
                ),
                rows:
                  tableData.tableId &&
                  existingTable.tableId &&
                  tableData.tableId === existingTable.tableId
                    ? tableData.rows
                    : [...existingTable.rows, ...tableData.rows],
              };
              const nextTableDataList = [...list];

              nextTableDataList[candidateTableIndex] = mergedTable;

              const next = [
                ...prev.slice(0, -1),
                { ...last, tableDataList: nextTableDataList },
              ];

              streamedMessagesRef.current = next;
              setMessages(next);
              return;
            }

            const next = [
              ...prev.slice(0, -1),
              { ...last, tableDataList: [...list, tableData] },
            ];
            streamedMessagesRef.current = next;
            setMessages(next);
          }
        }
        return;
      }

      if (eventType === 'org_chart') {
        const orgChartData = (
          data as {
            orgChart?: {
              companyId?: string;
              companyName?: string;
              slug?: string;
              viewUrl?: string;
              country?: string;
              functionRoot?: string;
            };
          }
        ).orgChart;
        if (orgChartData?.companyId && orgChartData?.viewUrl) {
          const prev = streamedMessagesRef.current;
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            const orgCharts = last.orgCharts ?? [];
            const companyId = orgChartData.companyId;
            const companyName = orgChartData.companyName || companyId;
            const slug = orgChartData.slug || companyId;
            const next = [
              ...prev.slice(0, -1),
              {
                ...last,
                orgCharts: [
                  ...orgCharts,
                  {
                    companyId,
                    companyName,
                    slug,
                    viewUrl: orgChartData.viewUrl,
                    country: orgChartData.country,
                    functionRoot: orgChartData.functionRoot,
                  },
                ],
              },
            ];
            streamedMessagesRef.current = next;
            setMessages(next);
          }
        }
        return;
      }

      if (eventType === 'done') {
        const text =
          typeof (data as { text?: unknown }).text === 'string'
            ? (data as { text: string }).text
            : '';
        const toolCalls = Array.isArray(
          (data as { toolCalls?: unknown }).toolCalls,
        )
          ? (
              data as {
                toolCalls: { name: string; args: Record<string, unknown> }[];
              }
            ).toolCalls
          : undefined;
        const toolResults = Array.isArray(
          (data as { toolResults?: unknown }).toolResults,
        )
          ? (
              data as {
                toolResults: { content: string }[];
              }
            ).toolResults
          : undefined;

        const finalContent =
          accumulatedContentRef.current.trim() !== ''
            ? accumulatedContentRef.current
            : text;

        const prev = streamedMessagesRef.current;
        const next = [...prev];
        const streamingIndex = streamingMessageIndexRef.current;
        if (
          streamingIndex >= 0 &&
          streamingIndex < next.length &&
          next[streamingIndex]?.role === 'assistant'
        ) {
          next[streamingIndex] = {
            ...next[streamingIndex],
            content: finalContent,
            toolCalls,
            toolResults,
          };
        } else {
          const lastIndex = next.length - 1;
          const last = next[lastIndex];
          if (last?.role === 'assistant') {
            next[lastIndex] = {
              ...last,
              content: finalContent,
              toolCalls,
              toolResults,
            };
          }
        }
        streamedMessagesRef.current = next;
        setMessages(next);

        if (toolCalls && toolCalls.length > 0) {
          const names = toolCalls.map((t) => t.name).join(', ');
          onAgentEvent?.({
            status: 'completed',
            threadId,
            runId: undefined,
            summary: `Completed with tools: ${names}`,
            timestamp: Date.now(),
          });
        }

        streamingMessageIndexRef.current = -1;
        accumulatedContentRef.current = '';

        setStreamLogMinimized(true);

        setTimeout(() => {
          onMessageComplete?.();
        }, 800);
        return;
      }

      if (
        eventType === 'error' &&
        typeof (data as { error?: unknown }).error === 'string'
      ) {
        const message = (data as { error: string }).error;
        setError(message);
        const prev = streamedMessagesRef.current;
        const lastUserIdx = prev.findLastIndex((m) => m.role === 'user');
        const next = lastUserIdx >= 0 ? prev.slice(0, lastUserIdx) : prev;
        streamedMessagesRef.current = next;
        setMessages(next);
        streamingMessageIndexRef.current = -1;
        accumulatedContentRef.current = '';
        return;
      }

      if (
        eventType === 'thread_name' &&
        typeof (data as { name?: unknown }).name === 'string'
      ) {
        const name = (data as { name: string }).name;
        onThreadNameChange?.(stripThreadNameQuotes(name));
      }

      if (
        eventType === 'job_attached' &&
        typeof (data as { projectId?: unknown }).projectId === 'string'
      ) {
        const projectId = (data as { projectId: string }).projectId;
        onJobAttached?.(projectId);
      }
    },
    [
      onAgentEvent,
      onJobAttached,
      onMessageComplete,
      onStreamMessage,
      onTableData,
      onThreadNameChange,
      setMessages,
      statusMessagePolicy,
      threadId,
    ],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!token || !baseUrl) {
        setError('Not authenticated or server URL not set.');
        return;
      }
      const trimmed = text.trim();
      if (!trimmed) {
        return;
      }

      setError(null);
      setStreamLog([]);
      setStreamLogMinimized(false);

      const conversationHistory = buildConversationHistory(
        messages,
        statusMessagePolicy,
      );
      initializeStreamingState(trimmed);

      try {
        const controller = new AbortController();
        activeRequestControllerRef.current = controller;
        const res = await fetch(`${baseUrl}/assistant/chat/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: trimmed,
            conversationHistory,
            ...(threadId ? { threadId } : {}),
            ...(selectedCandidateIds?.length ? { selectedCandidateIds } : {}),
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const errorMessage =
            (data as { error?: string }).error ??
            (data as { message?: string }).message ??
            'Request failed';
          setError(errorMessage ?? 'Request failed');
          revertLastMessageAndResetStreaming();
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          setError('Stream not available');
          revertLastMessageAndResetStreaming();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() ?? '';
          for (const raw of events) {
            const parsed = parseServerSentEvent(raw);
            if (!parsed) {
              continue;
            }
            try {
              const data = JSON.parse(parsed.dataStr) as Record<
                string,
                unknown
              >;
              handleSseEvent(parsed.eventType, data);
            } catch {
              // ignore malformed data
            }
          }
        }

        if (buffer.trim()) {
          const parsed = parseServerSentEvent(buffer);
          if (parsed) {
            try {
              const data = JSON.parse(parsed.dataStr) as Record<
                string,
                unknown
              >;
              handleSseEvent(parsed.eventType, data);
            } catch {
              // ignore malformed data
            }
          }
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') {
          setStreamLog((prev) => [...prev, 'Run stopped.']);
          resetStreamingRefs();
          return;
        }
        const message = e instanceof Error ? e.message : 'Network error';
        setError(message);
        const prev = streamedMessagesRef.current;
        const lastUserIdx = prev.findLastIndex((m) => m.role === 'user');
        const reverted = lastUserIdx >= 0 ? prev.slice(0, lastUserIdx) : prev;
        streamedMessagesRef.current = reverted;
        setMessages(reverted);
        resetStreamingRefs();
      } finally {
        activeRequestControllerRef.current = null;
        setLoading(false);
      }
    },
    [
      baseUrl,
      handleSseEvent,
      messages,
      selectedCandidateIds,
      setMessages,
      threadId,
      token,
    ],
  );

  return {
    sendMessage,
    loading,
    streamLog,
    streamLogMinimized,
    setStreamLogMinimized,
    error,
    setError,
    stopMessage,
  };
};
