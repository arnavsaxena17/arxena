import type { AssistantTableData } from '@/assistant/components/AssistantDetailsTable';
import { AssistantResultsPanel } from '@/assistant/components/AssistantResultsPanel';
import { McpClientChat } from '@/assistant/components/McpClientChat';
import type {
  AssistantChatMessage,
  AssistantThread,
} from '@/assistant/types/assistant.types';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { TextInput } from '@/ui/input/components/TextInput';
import { PageBody } from '@/ui/layout/page/components/PageBody';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';
import { useIsMobile } from '@/ui/utilities/responsive/hooks/useIsMobile';
import styled from '@emotion/styled';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { Button, IconMessage, IconPlus } from 'twenty-ui';

const baseUrl = process.env.REACT_APP_SERVER_BASE_URL ?? '';

const ASSISTANT_THREADS_STORAGE_KEY = 'assistant_threads';

function loadThreadsFromStorage(): AssistantThread[] {
  try {
    const raw = localStorage.getItem(ASSISTANT_THREADS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AssistantThread[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveThreadsToStorage(threads: AssistantThread[]) {
  try {
    localStorage.setItem(ASSISTANT_THREADS_STORAGE_KEY, JSON.stringify(threads));
  } catch {
    // ignore
  }
}

function createNewThread(name = 'New thread'): AssistantThread {
  return {
    id: crypto.randomUUID(),
  name,
    messages: [],
    lastTableData: null,
  };
}

const StyledPageContainer = styled(PageContainer)`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const StyledPageBody = styled(PageBody)`
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const StyledSplitLayout = styled.div<{ isMobile: boolean }>`
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: ${({ isMobile }) => (isMobile ? 'column' : 'row')};
`;

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

const StyledPageHeader = styled(PageHeader)`
  flex-shrink: 0;
  padding: 12px 24px;
  overflow: visible;
  position: relative;
  z-index: 10;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};

  & > div {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    position: relative;
  }
  & > div > div:first-of-type {
    width: auto;
    flex: 0 1 auto;
    min-width: 0;
  }
  & > div > div:last-of-type {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: flex-end;
    gap: ${({ theme }) => theme.spacing(2)};
    position: relative;
  }

  @media (max-width: 768px) {
    padding: 8px 16px;
  }
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

export const AssistantPage = () => {
  const isMobile = useIsMobile();
  const tokenPair = useRecoilValue(tokenPairState);
  const token = tokenPair?.accessToken?.token;
  const [threads, setThreads] = useState<AssistantThread[]>(() => {
    const loaded = loadThreadsFromStorage();
    if (loaded.length === 0) return [createNewThread()];
    return loaded;
  });
  const [currentThreadId, setCurrentThreadId] = useState<string>(() => {
    const loaded = loadThreadsFromStorage();
    return loaded.length > 0 ? loaded[0].id : '';
  });
  const [threadsLoadedFromBackend, setThreadsLoadedFromBackend] = useState(false);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [editingThreadName, setEditingThreadName] = useState(false);

  useEffect(() => {
    if (threads.length > 0 && !threads.some((t) => t.id === currentThreadId)) {
      setCurrentThreadId(threads[0].id);
    }
  }, [threads, currentThreadId]);

  useEffect(() => {
    if (!baseUrl || !token || threadsLoadedFromBackend) {
      setThreadsLoading(false);
      return;
    }
    let cancelled = false;
    setThreadsLoading(true);
    
    // Safety timeout to ensure loading state is reset
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        setThreadsLoading(false);
        setThreadsLoadedFromBackend(true);
      }
    }, 30000); // 30 second timeout
    
    const loadFromBackend = async () => {
      try {
        const res = await fetch(`${baseUrl}/assistant/threads`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) {
          setThreadsLoading(false);
          return;
        }
        if (!res.ok) {
          setThreadsLoading(false);
          setThreadsLoadedFromBackend(true);
          return;
        }
        const data = (await res.json()) as { threads?: Array<{ id: string; name: string }>; error?: string };
        if (cancelled) {
          setThreadsLoading(false);
          return;
        }
        if (data.error || !Array.isArray(data.threads)) {
          setThreadsLoading(false);
          setThreadsLoadedFromBackend(true);
          return;
        }
        setThreadsLoadedFromBackend(true);
        if (data.threads.length === 0) {
          const createRes = await fetch(`${baseUrl}/assistant/threads`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ name: 'New thread' }),
          });
          if (cancelled) {
            setThreadsLoading(false);
            return;
          }
          if (!createRes.ok) {
            setThreadsLoading(false);
            return;
          }
          const created = (await createRes.json()) as { id?: string; name?: string };
          if (cancelled) {
            setThreadsLoading(false);
            return;
          }
          if (created.id) {
            setThreads([{ id: created.id, name: created.name ?? 'New thread', messages: [], lastTableData: null }]);
            setCurrentThreadId(created.id);
          }
        } else {
          setThreads(
            data.threads.map((t) => ({ id: t.id, name: t.name, messages: [], lastTableData: null })),
          );
          setCurrentThreadId(data.threads[0].id);
        }
        setThreadsLoading(false);
      } catch {
        if (!cancelled) {
          setThreadsLoadedFromBackend(true);
          setThreadsLoading(false);
        }
      }
    };
    loadFromBackend();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      setThreadsLoading(false);
    };
  }, [token, threadsLoadedFromBackend]);

  useEffect(() => {
    saveThreadsToStorage(threads);
  }, [threads]);

  // Load full thread data when selecting a backend thread
  const loadThreadData = useCallback(async () => {
    if (!baseUrl || !token || !currentThreadId || !threadsLoadedFromBackend) return;
    
    try {
      const res = await fetch(`${baseUrl}/assistant/threads/${currentThreadId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        messages?: Array<{
          role: 'user' | 'assistant';
          content: string;
          toolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
        }>;
        lastTableData?: AssistantTableData;
        error?: string;
      };
      if (data.error || !data.messages) return;

      const frontendMessages: AssistantChatMessage[] = data.messages.map((m) => ({
        role: m.role,
        content: m.content,
        toolCalls: m.toolCalls,
      }));

      setThreads((prev) => {
        const thread = prev.find((t) => t.id === currentThreadId);
        const currentCount = thread?.messages?.length ?? 0;
        // Never overwrite with API when we have more messages (streamed multi-bubble); backend often merges into one per turn
        const useCurrentMessages =
          currentCount > 0 && currentCount >= frontendMessages.length;
        const messages = useCurrentMessages ? thread!.messages! : frontendMessages;
        return prev.map((t) =>
          t.id === currentThreadId
            ? {
                ...t,
                messages,
                lastTableData: data.lastTableData ?? t.lastTableData ?? null,
              }
            : t,
        );
      });
    } catch {
      // ignore errors - thread will remain with current state
    }
  }, [baseUrl, token, currentThreadId, threadsLoadedFromBackend]);

  // Load thread data when thread is selected
  useEffect(() => {
    loadThreadData();
  }, [loadThreadData]);

  const currentThread =
    threads.find((t) => t.id === currentThreadId) ?? threads[0] ?? null;

  const handleMessagesChange = useCallback(
    (messages: typeof currentThread.messages) => {
      if (!currentThreadId) return;
      setThreads((prev) =>
        prev.map((t) =>
          t.id === currentThreadId ? { ...t, messages } : t,
        ),
      );
    },
    [currentThreadId],
  );

  const handleTableData = useCallback(
    (data: AssistantTableData) => {
      if (!currentThreadId) return;
      setThreads((prev) =>
        prev.map((t) =>
          t.id === currentThreadId ? { ...t, lastTableData: data } : t,
        ),
      );
    },
    [currentThreadId],
  );

  const handleNewThread = useCallback(async () => {
    if (baseUrl && token && threadsLoadedFromBackend) {
      try {
        const res = await fetch(`${baseUrl}/assistant/threads`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name: 'New thread' }),
        });
        if (res.ok) {
          const created = (await res.json()) as { id?: string; name?: string };
          const threadId = created.id;
          if (threadId) {
            const thread: AssistantThread = {
              id: threadId,
              name: created.name ?? 'New thread',
              messages: [],
              lastTableData: null,
            };
            setThreads((prev) => [...prev, thread]);
            setCurrentThreadId(threadId);
            return;
          }
        }
      } catch {
        // fall through to local
      }
    }
    const thread = createNewThread();
    setThreads((prev) => [...prev, thread]);
    setCurrentThreadId(thread.id);
  }, [token, threadsLoadedFromBackend]);

  const handleSelectThread = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      if (value === '__new__') {
        handleNewThread();
        return;
      }
      setCurrentThreadId(value);
    },
    [handleNewThread],
  );

  const handleThreadNameChange = useCallback(
    (name: string) => {
      if (!currentThreadId) return;
      setThreads((prev) =>
        prev.map((t) => (t.id === currentThreadId ? { ...t, name } : t)),
      );
      // Persist to backend if using backend threads
      if (baseUrl && token && threadsLoadedFromBackend && currentThreadId) {
        fetch(`${baseUrl}/assistant/threads/${currentThreadId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name }),
        }).catch(() => {
          // ignore errors - name update is best effort
        });
      }
    },
    [baseUrl, token, currentThreadId, threadsLoadedFromBackend],
  );

  const handleSyncTable = useCallback(async () => {
    if (!baseUrl || !token || !currentThreadId || !threadsLoadedFromBackend)
      return;
    try {
      const res = await fetch(`${baseUrl}/assistant/threads/${currentThreadId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        lastTableData?: AssistantTableData;
        error?: string;
      };
      if (data.error || !data.lastTableData) return;
      handleTableData(data.lastTableData);
    } catch {
      // ignore
    }
  }, [
    baseUrl,
    token,
    currentThreadId,
    threadsLoadedFromBackend,
    handleTableData,
  ]);

  const showSync =
    Boolean(baseUrl && token && currentThreadId && threadsLoadedFromBackend);

  return (
    <StyledPageContainer>
      <StyledPageHeader title="Assistant" Icon={IconMessage}>
        <Button
          title="New thread"
          Icon={IconPlus}
          variant="primary"
          onClick={handleNewThread}
          disabled={threadsLoading && threadsLoadedFromBackend}
        />
      </StyledPageHeader>
      <StyledPageBody>
        <StyledSplitLayout isMobile={isMobile}>
          <StyledChatPanel isMobile={isMobile}>
            <StyledThreadSelector aria-busy={threadsLoading}>
              <StyledThreadSelectRow>
                <StyledThreadSelect
                  value={
                    threads.some((t) => t.id === currentThreadId)
                      ? currentThreadId
                      : threads[0]?.id ?? '__new__'
                  }
                  onChange={handleSelectThread}
                  aria-label="Select conversation thread"
                  disabled={threadsLoading}
                >
                  <option value="__new__">+ New thread</option>
                  {threads.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </StyledThreadSelect>
                <Button
                  title="New thread"
                  onClick={handleNewThread}
                  disabled={threadsLoading && threadsLoadedFromBackend}
                />
              </StyledThreadSelectRow>
              {currentThread && (
                <StyledThreadNameInput
                  value={currentThread.name}
                  onChange={(value: string) => handleThreadNameChange(value)}
                  placeholder="Thread name"
                  onBlur={() => setEditingThreadName(false)}
                  onFocus={() => setEditingThreadName(true)}
                  fullWidth
                />
              )}
            </StyledThreadSelector>
            {currentThread && (
              <McpClientChat
                messages={currentThread.messages}
                onMessagesChange={handleMessagesChange}
                onTableData={handleTableData}
                threadId={currentThreadId || undefined}
                onThreadNameChange={handleThreadNameChange}
                onMessageComplete={loadThreadData}
              />
            )}
          </StyledChatPanel>
          <AssistantResultsPanel
            tableData={currentThread?.lastTableData ?? null}
            maxTableHeight={600}
            threadId={showSync ? currentThreadId ?? undefined : undefined}
            onSync={showSync ? handleSyncTable : undefined}
          />
        </StyledSplitLayout>
      </StyledPageBody>
    </StyledPageContainer>
  );
};
