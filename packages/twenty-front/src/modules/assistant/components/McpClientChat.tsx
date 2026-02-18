import {
  AssistantDetailsTable,
  AssistantTableData,
} from '@/assistant/components/AssistantDetailsTable';
import type { AssistantChatMessage } from '@/assistant/types/assistant.types';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { TextInput } from '@/ui/input/components/TextInput';
import styled from '@emotion/styled';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { Button } from 'twenty-ui';

type TextSegment = {
  type: 'text' | 'bold' | 'markdownLink' | 'url' | 'phone' | 'id';
  content: string;
  url?: string;
  start: number;
  end: number;
};

const parseRichText = (text: string): React.ReactNode[] => {
  const segments: TextSegment[] = [];
  let key = 0;

  // 1. Find markdown links [text](url) - process first to avoid conflicts
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = markdownLinkRegex.exec(text)) !== null) {
    segments.push({
      type: 'markdownLink',
      content: match[1],
      url: match[2],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  // 2. Find bold text **text**
  const boldRegex = /\*\*([^*]+)\*\*/g;
  while ((match = boldRegex.exec(text)) !== null) {
    // Check if this bold text overlaps with a markdown link
    const matchIndex = match.index;
    const matchLength = match[0].length;
    const overlaps = segments.some(
      (s) => s.type === 'markdownLink' && s.start < matchIndex + matchLength && s.end > matchIndex,
    );
    if (!overlaps) {
      segments.push({
        type: 'bold',
        content: match[1],
        start: matchIndex,
        end: matchIndex + matchLength,
      });
    }
  }

  // 3. Find plain URLs (http://, https://, www.)
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  while ((match = urlRegex.exec(text)) !== null) {
    // Check if this URL is already part of a markdown link
    const matchIndex = match.index;
    const matchLength = match[0].length;
    const isInMarkdownLink = segments.some(
      (s) => s.type === 'markdownLink' && s.start <= matchIndex && s.end >= matchIndex + matchLength,
    );
    if (!isInMarkdownLink) {
      let url = match[0];
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      segments.push({
        type: 'url',
        content: match[0],
        url,
        start: matchIndex,
        end: matchIndex + matchLength,
      });
    }
  }

  // 4. Find phone numbers (various formats)
  const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+\d{10,15}/g;
  while ((match = phoneRegex.exec(text)) !== null) {
    // Check if this phone number is already part of a processed segment
    const matchIndex = match.index;
    const matchLength = match[0].length;
    const isProcessed = segments.some(
      (s) => s.start <= matchIndex && s.end >= matchIndex + matchLength,
    );
    if (!isProcessed) {
      const phoneNumber = match[0].replace(/\s/g, '');
      segments.push({
        type: 'phone',
        content: match[0],
        url: `tel:${phoneNumber}`,
        start: matchIndex,
        end: matchIndex + matchLength,
      });
    }
  }

  // 5. Find UUIDs and common ID patterns
  const uuidRegex = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
  while ((match = uuidRegex.exec(text)) !== null) {
    // Check if this ID is already part of a processed segment
    const matchIndex = match.index;
    const matchLength = match[0].length;
    const isProcessed = segments.some(
      (s) => s.start <= matchIndex && s.end >= matchIndex + matchLength,
    );
    if (!isProcessed) {
      segments.push({
        type: 'id',
        content: match[0],
        url: `#${match[0]}`,
        start: matchIndex,
        end: matchIndex + matchLength,
      });
    }
  }

  // Sort segments by start position
  segments.sort((a, b) => a.start - b.start);

  // Build React nodes from segments
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const segment of segments) {
    // Add text before this segment
    if (segment.start > lastIndex) {
      const beforeText = text.slice(lastIndex, segment.start);
      if (beforeText) {
        parts.push(beforeText);
      }
    }

    // Add the segment as appropriate React element
    switch (segment.type) {
      case 'bold':
        parts.push(<strong key={key++}>{segment.content}</strong>);
        break;
      case 'markdownLink':
        parts.push(
          <a key={key++} href={segment.url} target="_blank" rel="noopener noreferrer">
            {segment.content}
          </a>,
        );
        break;
      case 'url':
        parts.push(
          <a key={key++} href={segment.url} target="_blank" rel="noopener noreferrer">
            {segment.content}
          </a>,
        );
        break;
      case 'phone':
        parts.push(
          <a key={key++} href={segment.url}>
            {segment.content}
          </a>,
        );
        break;
      case 'id':
        parts.push(
          <a key={key++} href={segment.url} style={{ cursor: 'pointer', textDecoration: 'underline' }}>
            {segment.content}
          </a>,
        );
        break;
      default:
        parts.push(segment.content);
    }

    lastIndex = segment.end;
  }

  // Add remaining text after the last segment
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
};

export type { AssistantChatMessage };

export type McpClientChatProps = {
  messages?: AssistantChatMessage[];
  onMessagesChange?: (messages: AssistantChatMessage[]) => void;
  onTableData?: (data: AssistantTableData) => void;
  threadId?: string;
  onThreadNameChange?: (name: string) => void;
  onMessageComplete?: () => void;
  /** Called when backend sends a message event (e.g. parsed_requirement, master_lists, query_set) */
  onStreamMessage?: (type: string, data: unknown) => void;
};

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: 720px;
  width: 90%;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing(4)};
  min-height: 0;
`;

const StyledMessages = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
  margin-bottom: ${({ theme }) => theme.spacing(3)};
`;

const StyledMessage = styled.div<{ isUser: boolean }>`
  align-self: ${({ isUser }) => (isUser ? 'flex-end' : 'flex-start')};
  max-width: 85%;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  border-radius: ${({ theme }) => theme.border.radius.md};
  background-color: ${({ theme, isUser }) =>
    isUser ? theme.background.transparent.light : theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  font-size: ${({ theme }) => theme.font.size.md};
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: break-word;
`;

const StyledToolCalls = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
  margin-top: ${({ theme }) => theme.spacing(1)};
`;

const StyledOrgChartPreview = styled.div`
  margin-top: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  background-color: ${({ theme }) => theme.background.secondary};
`;

const StyledOrgChartImage = styled.img`
  max-width: 200px;
  max-height: 150px;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  cursor: pointer;
  transition: opacity 0.2s;
  &:hover {
    opacity: 0.8;
  }
`;

const StyledOrgChartLink = styled.a`
  display: inline-block;
  text-decoration: none;
  color: ${({ theme }) => theme.font.color.primary};
  &:hover {
    text-decoration: underline;
  }
`;

const StyledOrgChartInfo = styled.div`
  margin-top: ${({ theme }) => theme.spacing(1)};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledForm = styled.form`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  flex-shrink: 0;
  width: 100%;
`;

const StyledInputWrapper = styled.div`
  flex: 1;
  width: 100%;
`;

const StyledStreamLog = styled.div`
  flex-shrink: 0;
  max-height: 120px;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing(1, 2)};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ theme }) => theme.background.tertiary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(0.5)};
`;

const StyledStreamLogMinimized = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(1, 2)};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ theme }) => theme.background.tertiary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledStreamLogExpandButton = styled.button`
  flex-shrink: 0;
  padding: ${({ theme }) => theme.spacing(0.5, 1)};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
  background: transparent;
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  cursor: pointer;
  &:hover {
    opacity: 0.9;
  }
`;

const StyledStreamLogHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing(0.5)};
`;

const StyledErrorBanner = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: ${({ theme }) => theme.background.danger};
  color: ${({ theme }) => theme.font.color.danger};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledErrorText = styled.span`
  flex: 1;
  min-width: 0;
`;

const StyledRetryButton = styled.button`
  flex-shrink: 0;
  padding: ${({ theme }) => theme.spacing(1, 2)};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.danger};
  background: transparent;
  border: 1px solid ${({ theme }) => theme.border.color.danger};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  cursor: pointer;
  &:hover {
    opacity: 0.9;
  }
`;

const baseUrl = process.env.REACT_APP_SERVER_BASE_URL ?? '';

function useControlledMessages(
  controlled: AssistantChatMessage[] | undefined,
  onControlledChange: ((m: AssistantChatMessage[]) => void) | undefined,
): [AssistantChatMessage[], (messages: AssistantChatMessage[] | ((prev: AssistantChatMessage[]) => AssistantChatMessage[])) => void] {
  const [internal, setInternal] = useState<AssistantChatMessage[]>([]);
  const isControlled = controlled !== undefined && onControlledChange !== undefined;
  const messages = isControlled ? controlled : internal;
  const setMessages = useCallback(
    (arg: AssistantChatMessage[] | ((prev: AssistantChatMessage[]) => AssistantChatMessage[])) => {
      if (isControlled && onControlledChange) {
        const next = typeof arg === 'function' ? arg(controlled) : arg;
        onControlledChange(next);
      } else {
        setInternal((prev) => (typeof arg === 'function' ? arg(prev) : arg));
      }
    },
    [isControlled, controlled, onControlledChange],
  );
  return [messages, setMessages];
}

export const McpClientChat = ({
  messages: controlledMessages,
  onMessagesChange,
  onTableData,
  threadId,
  onThreadNameChange,
  onMessageComplete,
  onStreamMessage,
}: McpClientChatProps) => {
  const tokenPair = useRecoilValue(tokenPairState);
  const navigate = useNavigate();
  const [messages, setMessages] = useControlledMessages(
    controlledMessages,
    onMessagesChange,
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamLog, setStreamLog] = useState<string[]>([]);
  const [streamLogMinimized, setStreamLogMinimized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const streamingMessageIndexRef = useRef<number>(-1);
  const accumulatedContentRef = useRef<string>('');
  const lastBubbleIsTextRunRef = useRef<boolean>(false);
  /** During streaming, we always append/update from this ref so we never overwrite or drop previous bubbles (avoids stale prev in controlled mode). */
  const streamedMessagesRef = useRef<AssistantChatMessage[]>([]);

  const scrollToBottom = useCallback((instant = false) => {
    if (instant && messagesContainerRef.current) {
      // Direct scroll for instant updates during streaming
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    // Clear stream log when switching threads (e.g. clicking "New thread")
    setStreamLog([]);
    setStreamLogMinimized(false);
  }, [threadId]);

  useEffect(() => {
    // Scroll instantly during streaming to keep up with content
    const isStreaming = loading && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant';
    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(() => {
      scrollToBottom(isStreaming);
    });
  }, [messages, loading, scrollToBottom]);

  const sendMessage = useCallback(
    async (text: string) => {
      const token = tokenPair?.accessToken?.token;
      if (!token || !baseUrl) {
        setError('Not authenticated or server URL not set.');
        return;
      }
      const trimmed = text.trim();
      if (!trimmed) return;

      setError(null);
      setInput('');
      setStreamLog([]);
      setStreamLogMinimized(false);

      // Build conversation history from current messages before adding new ones
      const conversationHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Initialize streaming state; assistant bubbles are added as events arrive
      accumulatedContentRef.current = '';
      lastBubbleIsTextRunRef.current = false;
      const withUserMessage: AssistantChatMessage[] = [
        ...messages,
        { role: 'user' as const, content: trimmed },
      ];
      streamedMessagesRef.current = withUserMessage;
      setMessages(withUserMessage);
      setLoading(true);

      try {

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
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const errorMessage = data?.error ?? data?.message ?? 'Request failed';
          setError(errorMessage);
          const reverted = streamedMessagesRef.current.slice(0, -1);
          streamedMessagesRef.current = reverted;
          setMessages(reverted);
          streamingMessageIndexRef.current = -1;
          accumulatedContentRef.current = '';
          setLoading(false);
          return;
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        if (!reader) {
          setError('Stream not available');
          const reverted = streamedMessagesRef.current.slice(0, -1);
          streamedMessagesRef.current = reverted;
          setMessages(reverted);
          streamingMessageIndexRef.current = -1;
          accumulatedContentRef.current = '';
          setLoading(false);
          return;
        }

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
            try {
              const data = JSON.parse(dataStr) as Record<string, unknown>;
              // New bubble per tool_use / status / message; one bubble per run of text deltas; when deltas end, next event opens a new bubble. Always append from streamedMessagesRef so we never overwrite/remove previous bubbles.
              if (eventType === 'tool_use' && typeof data.name === 'string') {
                lastBubbleIsTextRunRef.current = false;
                const toolName = data.name as string;
                const next = [...streamedMessagesRef.current, { role: 'assistant' as const, content: `Using: ${toolName}` }];
                streamingMessageIndexRef.current = next.length - 1;
                streamedMessagesRef.current = next;
                setMessages(next);
              }
              if (eventType === 'status' && typeof data.message === 'string') {
                setStreamLog((prev) => [...prev, data.message as string]);
                lastBubbleIsTextRunRef.current = false;
                const statusText = data.message as string;
                const next = [...streamedMessagesRef.current, { role: 'assistant' as const, content: statusText }];
                streamingMessageIndexRef.current = next.length - 1;
                streamedMessagesRef.current = next;
                setMessages(next);
              }
              if (eventType === 'message') {
                lastBubbleIsTextRunRef.current = false;
                const msgType = typeof data.type === 'string' ? data.type : '';
                if (msgType) setStreamLog((prev) => [...prev, msgType]);
                onStreamMessage?.(msgType, data.data ?? data);
                const chatMessage = typeof data.chatMessage === 'string' ? data.chatMessage : null;
                const displayText = chatMessage ?? (msgType
                  ? `**${msgType}**\n${typeof data.data !== 'undefined' ? JSON.stringify(data.data, null, 2) : ''}`
                  : '');
                if (displayText) {
                  const next = [...streamedMessagesRef.current, { role: 'assistant' as const, content: displayText }];
                  streamingMessageIndexRef.current = next.length - 1;
                  streamedMessagesRef.current = next;
                  setMessages(next);
                }
              }
              if (eventType === 'text' && typeof data.delta === 'string') {
                const isNewTextRun = !lastBubbleIsTextRunRef.current;
                if (isNewTextRun) {
                  accumulatedContentRef.current = data.delta;
                  lastBubbleIsTextRunRef.current = true;
                } else {
                  accumulatedContentRef.current += data.delta;
                }
                const prev = streamedMessagesRef.current;
                const next = [...prev];
                const streamingIndex = streamingMessageIndexRef.current;
                if (isNewTextRun) {
                  next.push({ role: 'assistant' as const, content: accumulatedContentRef.current });
                  streamingMessageIndexRef.current = next.length - 1;
                } else if (streamingIndex >= 0 && streamingIndex < next.length && next[streamingIndex]?.role === 'assistant') {
                  next[streamingIndex] = {
                    ...next[streamingIndex],
                    content: accumulatedContentRef.current,
                  };
                } else {
                  next.push({ role: 'assistant' as const, content: accumulatedContentRef.current });
                  streamingMessageIndexRef.current = next.length - 1;
                }
                streamedMessagesRef.current = next;
                setMessages(next);
              }
              if (eventType === 'table_data') {
                const columns = Array.isArray(data.columns)
                  ? (data.columns as string[])
                  : [];
                const rows = Array.isArray(data.rows) ? data.rows : [];
                if (columns.length > 0 && rows.length > 0) {
                  const tableData = { columns, rows: rows as Record<string, unknown>[] };
                  onTableData?.(tableData);
                  const prev = streamedMessagesRef.current;
                  const last = prev[prev.length - 1];
                  if (last?.role === 'assistant') {
                    const list = last.tableDataList ?? [];
                    const next = [...prev.slice(0, -1), { ...last, tableDataList: [...list, tableData] }];
                    streamedMessagesRef.current = next;
                    setMessages(next);
                  }
                }
              }
              if (eventType === 'org_chart') {
                const orgChartData = data.orgChart as {
                  companyId?: string;
                  companyName?: string;
                  slug?: string;
                  viewUrl?: string;
                  country?: string;
                  functionRoot?: string;
                } | undefined;
                if (orgChartData?.companyId && orgChartData?.viewUrl) {
                  const prev = streamedMessagesRef.current;
                  const last = prev[prev.length - 1];
                  if (last?.role === 'assistant') {
                    const orgCharts = last.orgCharts ?? [];
                    const companyId = orgChartData.companyId!;
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
                            viewUrl: orgChartData.viewUrl!,
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
              }
              if (eventType === 'done') {
                const text = typeof data.text === 'string' ? data.text : '';
                const toolCalls = Array.isArray(data.toolCalls) ? data.toolCalls : undefined;

                const finalContent =
                  accumulatedContentRef.current.trim() !== ''
                    ? accumulatedContentRef.current
                    : text;

                const prev = streamedMessagesRef.current;
                const next = [...prev];
                const streamingIndex = streamingMessageIndexRef.current;
                if (streamingIndex >= 0 && streamingIndex < next.length && next[streamingIndex]?.role === 'assistant') {
                  next[streamingIndex] = {
                    ...next[streamingIndex],
                    content: finalContent,
                    toolCalls,
                  };
                } else {
                  const lastIndex = next.length - 1;
                  const last = next[lastIndex];
                  if (last?.role === 'assistant') {
                    next[lastIndex] = { ...last, content: finalContent, toolCalls };
                  }
                }
                streamedMessagesRef.current = next;
                setMessages(next);

                streamingMessageIndexRef.current = -1;
                accumulatedContentRef.current = '';

                setStreamLogMinimized(true);

                setTimeout(() => {
                  onMessageComplete?.();
                }, 500);
              }
              if (eventType === 'error' && typeof data.error === 'string') {
                setError(data.error);
                const prev = streamedMessagesRef.current;
                const lastUserIdx = prev.findLastIndex((m) => m.role === 'user');
                const next = lastUserIdx >= 0 ? prev.slice(0, lastUserIdx) : prev;
                streamedMessagesRef.current = next;
                setMessages(next);
                streamingMessageIndexRef.current = -1;
                accumulatedContentRef.current = '';
              }
              if (eventType === 'thread_name' && typeof data.name === 'string') {
                onThreadNameChange?.(data.name);
              }
            } catch {
              // ignore malformed data
            }
          }
        }

        // Process any remaining buffer when stream ends (last event may lack trailing \n\n)
        if (buffer.trim()) {
          let eventType = 'message';
          let dataStr = '';
          for (const line of buffer.split('\n')) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim();
            if (line.startsWith('data: ')) dataStr = line.slice(6);
          }
          if (dataStr) {
            try {
              const data = JSON.parse(dataStr) as Record<string, unknown>;
              if (eventType === 'tool_use' && typeof data.name === 'string') {
                lastBubbleIsTextRunRef.current = false;
                const toolName = data.name as string;
                const next = [...streamedMessagesRef.current, { role: 'assistant' as const, content: `Using: ${toolName}` }];
                streamingMessageIndexRef.current = next.length - 1;
                streamedMessagesRef.current = next;
                setMessages(next);
              }
              if (eventType === 'status' && typeof data.message === 'string') {
                setStreamLog((prev) => [...prev, data.message as string]);
                lastBubbleIsTextRunRef.current = false;
                const statusText = data.message as string;
                const next = [...streamedMessagesRef.current, { role: 'assistant' as const, content: statusText }];
                streamingMessageIndexRef.current = next.length - 1;
                streamedMessagesRef.current = next;
                setMessages(next);
              }
              if (eventType === 'message') {
                lastBubbleIsTextRunRef.current = false;
                const msgType = typeof data.type === 'string' ? data.type : '';
                if (msgType) setStreamLog((prev) => [...prev, msgType]);
                onStreamMessage?.(msgType, data.data ?? data);
                const chatMessage = typeof data.chatMessage === 'string' ? data.chatMessage : null;
                const displayText = chatMessage ?? (msgType
                  ? `**${msgType}**\n${typeof data.data !== 'undefined' ? JSON.stringify(data.data, null, 2) : ''}`
                  : '');
                if (displayText) {
                  const next = [...streamedMessagesRef.current, { role: 'assistant' as const, content: displayText }];
                  streamingMessageIndexRef.current = next.length - 1;
                  streamedMessagesRef.current = next;
                  setMessages(next);
                }
              }
              if (eventType === 'text' && typeof data.delta === 'string') {
                const isNewTextRun = !lastBubbleIsTextRunRef.current;
                if (isNewTextRun) {
                  accumulatedContentRef.current = data.delta;
                  lastBubbleIsTextRunRef.current = true;
                } else {
                  accumulatedContentRef.current += data.delta;
                }
                const prev = streamedMessagesRef.current;
                const next = [...prev];
                const streamingIndex = streamingMessageIndexRef.current;
                if (isNewTextRun) {
                  next.push({ role: 'assistant' as const, content: accumulatedContentRef.current });
                  streamingMessageIndexRef.current = next.length - 1;
                } else if (streamingIndex >= 0 && streamingIndex < next.length && next[streamingIndex]?.role === 'assistant') {
                  next[streamingIndex] = {
                    ...next[streamingIndex],
                    content: accumulatedContentRef.current,
                  };
                } else {
                  next.push({ role: 'assistant' as const, content: accumulatedContentRef.current });
                  streamingMessageIndexRef.current = next.length - 1;
                }
                streamedMessagesRef.current = next;
                setMessages(next);
              }
              if (eventType === 'table_data') {
                const columns = Array.isArray(data.columns) ? (data.columns as string[]) : [];
                const rows = Array.isArray(data.rows) ? data.rows : [];
                if (columns.length > 0 && rows.length > 0) {
                  const tableData = { columns, rows: rows as Record<string, unknown>[] };
                  onTableData?.(tableData);
                  const prev = streamedMessagesRef.current;
                  const last = prev[prev.length - 1];
                  if (last?.role === 'assistant') {
                    const next = [...prev.slice(0, -1), { ...last, tableDataList: [...(last.tableDataList ?? []), tableData] }];
                    streamedMessagesRef.current = next;
                    setMessages(next);
                  }
                }
              }
              if (eventType === 'done') {
                const text = typeof data.text === 'string' ? data.text : '';
                const toolCalls = Array.isArray(data.toolCalls) ? data.toolCalls : undefined;
                const finalContent =
                  accumulatedContentRef.current.trim() !== ''
                    ? accumulatedContentRef.current
                    : text;
                const prev = streamedMessagesRef.current;
                const next = [...prev];
                const idx = streamingMessageIndexRef.current;
                if (idx >= 0 && idx < next.length && next[idx]?.role === 'assistant') {
                  next[idx] = { ...next[idx], content: finalContent, toolCalls };
                } else {
                  const lastIdx = next.length - 1;
                  if (next[lastIdx]?.role === 'assistant') {
                    next[lastIdx] = { ...next[lastIdx], content: finalContent, toolCalls };
                  }
                }
                streamedMessagesRef.current = next;
                setMessages(next);
                streamingMessageIndexRef.current = -1;
                accumulatedContentRef.current = '';
                setStreamLogMinimized(true);
                setTimeout(() => onMessageComplete?.(), 500);
              }
              if (eventType === 'error' && typeof data.error === 'string') {
                setError(data.error);
                const prev = streamedMessagesRef.current;
                const lastUserIdx = prev.findLastIndex((m) => m.role === 'user');
                const next = lastUserIdx >= 0 ? prev.slice(0, lastUserIdx) : prev;
                streamedMessagesRef.current = next;
                setMessages(next);
                streamingMessageIndexRef.current = -1;
                accumulatedContentRef.current = '';
              }
              if (eventType === 'thread_name' && typeof data.name === 'string') {
                onThreadNameChange?.(data.name);
              }
            } catch {
              // ignore malformed data
            }
          }
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Network error';
        setError(message);
        const prev = streamedMessagesRef.current;
        const lastUserIdx = prev.findLastIndex((m) => m.role === 'user');
        const reverted = lastUserIdx >= 0 ? prev.slice(0, lastUserIdx) : prev;
        streamedMessagesRef.current = reverted;
        setMessages(reverted);
        streamingMessageIndexRef.current = -1;
        accumulatedContentRef.current = '';
      } finally {
        setLoading(false);
      }
    },
    [messages, tokenPair, threadId, onMessageComplete, onStreamMessage],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      sendMessage(input);
    },
    [input, sendMessage],
  );

  return (
    <StyledContainer>
      <StyledMessages ref={messagesContainerRef}>
        {/* {messages.length === 0 && (
          <StyledMessage isUser={false}>
            Ask anything about jobs, candidates, companies, or people. I can use Arxena tools to look up data for you.
          </StyledMessage>
        )} */}
        {messages.map((msg, i) => (
          <div key={i}>
            <StyledMessage isUser={msg.role === 'user'}>
              {parseRichText(msg.content || '')}
            </StyledMessage>
            {msg.tableDataList?.map((tableData, tableIndex) => (
              <AssistantDetailsTable key={tableIndex} data={tableData} />
            ))}
            {msg.orgCharts?.map((orgChart, orgChartIndex) => {
              const logoUrl = `${baseUrl}/org-chart/company-logo?website=${encodeURIComponent(orgChart.companyName)}`;
              return (
                <StyledOrgChartPreview key={orgChartIndex}>
                  <StyledOrgChartLink
                    href={orgChart.viewUrl}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(orgChart.viewUrl);
                    }}
                  >
                    <StyledOrgChartImage
                      src={logoUrl}
                      alt={`${orgChart.companyName} org chart`}
                      onError={(e) => {
                        // Fallback to a placeholder if logo fails to load
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </StyledOrgChartLink>
                  <StyledOrgChartInfo>
                    <div>
                      <strong>{orgChart.companyName}</strong>
                    </div>
                    {orgChart.country && orgChart.country !== 'global' && (
                      <div>Country: {orgChart.country}</div>
                    )}
                    {orgChart.functionRoot && orgChart.functionRoot !== 'fullcompany' && (
                      <div>Function: {orgChart.functionRoot}</div>
                    )}
                    <div>
                      <StyledOrgChartLink
                        href={orgChart.viewUrl}
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(orgChart.viewUrl);
                        }}
                      >
                        View full org chart →
                      </StyledOrgChartLink>
                    </div>
                  </StyledOrgChartInfo>
                </StyledOrgChartPreview>
              );
            })}
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <StyledToolCalls>
                Used: {msg.toolCalls.map((t) => t.name).join(', ')}
              </StyledToolCalls>
            )}
          </div>
        ))}
        {loading && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
          <StyledMessage isUser={false}>Thinking…</StyledMessage>
        )}
        <div ref={messagesEndRef} />
      </StyledMessages>
      {streamLog.length > 0 && (
        streamLogMinimized ? (
          <StyledStreamLogMinimized role="log">
            <span>
              Stream log ({streamLog.length} {streamLog.length === 1 ? 'item' : 'items'})
            </span>
            <StyledStreamLogExpandButton
              type="button"
              onClick={() => setStreamLogMinimized(false)}
              aria-label="Expand stream log"
            >
              Expand
            </StyledStreamLogExpandButton>
          </StyledStreamLogMinimized>
        ) : (
          <StyledStreamLog role="log" aria-live="polite">
            <StyledStreamLogHeader>
              <span>Stream log</span>
              {!loading && (
                <StyledStreamLogExpandButton
                  type="button"
                  onClick={() => setStreamLogMinimized(true)}
                  aria-label="Minimize stream log"
                >
                  Minimize
                </StyledStreamLogExpandButton>
              )}
            </StyledStreamLogHeader>
            {streamLog.map((line, idx) => (
              <div key={idx}>{line}</div>
            ))}
          </StyledStreamLog>
        )
      )}
      {error && (
        <StyledErrorBanner role="alert">
          <StyledErrorText>{error}</StyledErrorText>
          <StyledRetryButton
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss and try again"
          >
            Dismiss
          </StyledRetryButton>
        </StyledErrorBanner>
      )}
      <StyledForm onSubmit={handleSubmit} aria-label="Chat input">
        <StyledInputWrapper>
          <TextInput
            value={input}
            onChange={setInput}
            placeholder="Type your message…"
            disabled={loading}
            fullWidth
            aria-label="Message"
          />
        </StyledInputWrapper>
        <Button
          title={loading ? 'Thinking…' : 'Send'}
          type="submit"
          disabled={loading}
          aria-label={loading ? 'Sending' : 'Send message'}
        />
      </StyledForm>
    </StyledContainer>
  );
};
