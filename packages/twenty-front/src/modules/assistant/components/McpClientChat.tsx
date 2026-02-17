import {
  AssistantDetailsTable,
  AssistantTableData,
} from '@/assistant/components/AssistantDetailsTable';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { TextInput } from '@/ui/input/components/TextInput';
import styled from '@emotion/styled';
import { useCallback, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { Button } from 'twenty-ui';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing(4)};
`;

const StyledMessages = styled.div`
  flex: 1;
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
`;

const StyledToolCalls = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
  margin-top: ${({ theme }) => theme.spacing(1)};
`;

const StyledForm = styled.form`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  flex-shrink: 0;
`;

const StyledInputWrapper = styled.div`
  flex: 1;
`;

const StyledError = styled.div`
  color: ${({ theme }) => theme.font.color.danger};
  font-size: ${({ theme }) => theme.font.size.sm};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
`;

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
  tableDataList?: AssistantTableData[];
};

const baseUrl = process.env.REACT_APP_SERVER_BASE_URL ?? '';

export const McpClientChat = () => {
  const tokenPair = useRecoilValue(tokenPairState);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
      setLoading(true);
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      try {
        const conversationHistory = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await fetch(`${baseUrl}/assistant/chat/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: trimmed,
            conversationHistory,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data?.error ?? data?.message ?? 'Request failed');
          setMessages((prev) => prev.slice(0, -2));
          setLoading(false);
          return;
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        if (!reader) {
          setError('Stream not available');
          setMessages((prev) => prev.slice(0, -2));
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
              if (eventType === 'text' && typeof data.delta === 'string') {
                setMessages((prev) => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last?.role === 'assistant')
                    next[next.length - 1] = { ...last, content: last.content + data.delta };
                  return next;
                });
              }
              if (eventType === 'table_data') {
                const columns = Array.isArray(data.columns)
                  ? (data.columns as string[])
                  : [];
                const rows = Array.isArray(data.rows) ? data.rows : [];
                if (columns.length > 0 && rows.length > 0) {
                  setMessages((prev) => {
                    const next = [...prev];
                    const last = next[next.length - 1];
                    if (last?.role === 'assistant') {
                      const list = last.tableDataList ?? [];
                      next[next.length - 1] = {
                        ...last,
                        tableDataList: [...list, { columns, rows }],
                      };
                    }
                    return next;
                  });
                }
              }
              if (eventType === 'done') {
                const text = typeof data.text === 'string' ? data.text : '';
                const toolCalls = Array.isArray(data.toolCalls) ? data.toolCalls : undefined;
                setMessages((prev) => {
                  const next = [...prev];
                  const last = next[next.length - 1];
                  if (last?.role === 'assistant')
                    next[next.length - 1] = { ...last, content: text || last.content, toolCalls };
                  return next;
                });
              }
              if (eventType === 'error' && typeof data.error === 'string') {
                setError(data.error);
                setMessages((prev) => (prev.length > 0 && prev[prev.length - 1]?.role === 'assistant' ? prev.slice(0, -1) : prev));
              }
            } catch {
              // ignore malformed data
            }
          }
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Network error';
        setError(message);
        setMessages((prev) => prev.slice(0, -2));
      } finally {
        setLoading(false);
      }
    },
    [messages, tokenPair],
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
      <StyledMessages>
        {messages.length === 0 && (
          <StyledMessage isUser={false}>
            Ask anything about jobs, candidates, companies, or people. I can use Arxena tools to look up data for you.
          </StyledMessage>
        )}
        {messages.map((msg, i) => (
          <div key={i}>
            <StyledMessage isUser={msg.role === 'user'}>
              {msg.role === 'assistant' && loading && i === messages.length - 1 && !msg.content
                ? 'Thinking…'
                : msg.content}
            </StyledMessage>
            {msg.tableDataList?.map((tableData, tableIndex) => (
              <AssistantDetailsTable key={tableIndex} data={tableData} />
            ))}
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <StyledToolCalls>
                Used: {msg.toolCalls.map((t) => t.name).join(', ')}
              </StyledToolCalls>
            )}
          </div>
        ))}
      </StyledMessages>
      {error && <StyledError>{error}</StyledError>}
      <StyledForm onSubmit={handleSubmit}>
        <StyledInputWrapper>
          <TextInput
            value={input}
            onChange={setInput}
            placeholder="Type your message…"
            disabled={loading}
            fullWidth
          />
        </StyledInputWrapper>
        <Button title="Send" type="submit" disabled={loading} />
      </StyledForm>
    </StyledContainer>
  );
};
