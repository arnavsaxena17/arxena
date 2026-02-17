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

      try {
        const conversationHistory = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await fetch(`${baseUrl}/assistant/chat`, {
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

        const data = await res.json();

        if (!res.ok) {
          setError(data?.error ?? data?.message ?? 'Request failed');
          setMessages((prev) => prev.slice(0, -1));
          return;
        }

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.text ?? '',
            toolCalls: data.toolCalls,
          },
        ]);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Network error';
        setError(message);
        setMessages((prev) => prev.slice(0, -1));
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
            <StyledMessage isUser={msg.role === 'user'}>{msg.content}</StyledMessage>
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <StyledToolCalls>
                Used: {msg.toolCalls.map((t) => t.name).join(', ')}
              </StyledToolCalls>
            )}
          </div>
        ))}
        {loading && (
          <StyledMessage isUser={false}>Thinking…</StyledMessage>
        )}
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
