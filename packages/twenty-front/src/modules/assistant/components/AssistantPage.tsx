import { AssistantChatColumn } from '@/assistant/components/AssistantChatColumn';
import type { AssistantTableData } from '@/assistant/components/AssistantDetailsTable';
import { AssistantResultsPanel } from '@/assistant/components/AssistantResultsPanel';
import { AssistantThreadSidebar } from '@/assistant/components/AssistantThreadSidebar';
import { MOCK_THREADS, USE_MOCK_ASSISTANT } from '@/assistant/mocks/mockThreads';
import type {
  AssistantAgentEvent,
  AssistantChatMessage,
  AssistantThread,
} from '@/assistant/types/assistant.types';
import { tokenPairState } from '@/auth/states/tokenPairState';
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

/** Show thread name without surrounding double quotes (LLM sometimes returns quoted names). */
export function displayThreadName(name: string): string {
  if (!name || typeof name !== 'string') return name ?? '';
  const t = name.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    return t.slice(1, -1).trim();
  }
  return t;
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

const useMockAssistant = (): boolean =>
  USE_MOCK_ASSISTANT || !(process.env.REACT_APP_SERVER_BASE_URL ?? '');

export const AssistantPage = () => {
  const isMobile = useIsMobile();
  const tokenPair = useRecoilValue(tokenPairState);
  const token = tokenPair?.accessToken?.token;
  const useMock = useMockAssistant();
  const [agentEvents, setAgentEvents] = useState<AssistantAgentEvent[]>([]);
  const [threads, setThreads] = useState<AssistantThread[]>(() => {
    if (USE_MOCK_ASSISTANT) {
      return MOCK_THREADS.map((t) => ({ ...t }));
    }
    const loaded = loadThreadsFromStorage();
    if (loaded.length === 0) return [createNewThread()];
    return loaded;
  });
  const [currentThreadId, setCurrentThreadId] = useState<string>(() => {
    if (USE_MOCK_ASSISTANT && MOCK_THREADS.length > 0) return MOCK_THREADS[0].id;
    const loaded = loadThreadsFromStorage();
    return loaded.length > 0 ? loaded[0].id : '';
  });
  const [threadsLoadedFromBackend, setThreadsLoadedFromBackend] = useState(USE_MOCK_ASSISTANT);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [editingThreadName, setEditingThreadName] = useState(false);

  useEffect(() => {
    if (threads.length > 0 && !threads.some((t) => t.id === currentThreadId)) {
      setCurrentThreadId(threads[0].id);
    }
  }, [threads, currentThreadId]);

  useEffect(() => {
    if (USE_MOCK_ASSISTANT) {
      setThreads(MOCK_THREADS.map((t) => ({ ...t })));
      setThreadsLoadedFromBackend(true);
      setThreadsLoading(false);
      if (MOCK_THREADS.length > 0 && !threads.some((t) => t.id === currentThreadId)) {
        setCurrentThreadId(MOCK_THREADS[0].id);
      }
      return;
    }
    if (!baseUrl || !token || threadsLoadedFromBackend) {
      setThreadsLoading(false);
      return;
    }
    let cancelled = false;
    setThreadsLoading(true);

    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        setThreadsLoading(false);
        setThreadsLoadedFromBackend(true);
      }
    }, 30000);

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
        const data = (await res.json()) as {
          threads?: Array<{ id: string; name: string; jobId?: string | null }>;
          error?: string;
        };
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
            setThreads([
              {
                id: created.id,
                name: created.name ?? 'New thread',
                messages: [],
                lastTableData: null,
                jobId: (created as { jobId?: string | null }).jobId ?? null,
              },
            ]);
            setCurrentThreadId(created.id);
          }
        } else {
          setThreads(
            data.threads.map((t) => ({
              id: t.id,
              name: t.name,
              messages: [],
              lastTableData: null,
              jobId: t.jobId ?? null,
            })),
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
    if (!useMock) saveThreadsToStorage(threads);
  }, [threads, useMock]);

  // Load full thread data when selecting a backend thread (or apply mock thread when in mock mode)
  const loadThreadData = useCallback(async () => {
    if (!currentThreadId || !threadsLoadedFromBackend) return;

    if (useMock) {
      const mockThread = MOCK_THREADS.find((t) => t.id === currentThreadId);
      if (mockThread) {
        setThreads((prev) =>
          prev.map((t) =>
            t.id === currentThreadId
              ? {
                  ...t,
                  messages: mockThread.messages,
                  lastTableData: mockThread.lastTableData ?? null,
                  agentNotes: mockThread.agentNotes,
                  jobId: mockThread.jobId ?? t.jobId,
                }
              : t,
          ),
        );
      }
      return;
    }

    if (!baseUrl || !token) return;

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
        jobId?: string | null;
        agentNotes?: Array<{ summary: string; createdAt?: string; id?: string }>;
        error?: string;
      };
      if (data.error) return;

      const messagesFromApi = data.messages ?? [];
      const frontendMessages: AssistantChatMessage[] = messagesFromApi.map((m) => ({
        role: m.role,
        content: m.content,
        toolCalls: m.toolCalls,
      }));

      setThreads((prev) => {
        const thread = prev.find((t) => t.id === currentThreadId);
        const currentCount = thread?.messages?.length ?? 0;
        const useCurrentMessages =
          currentCount > 0 && currentCount >= frontendMessages.length;
        const messages = useCurrentMessages ? (thread?.messages ?? []) : frontendMessages;
        return prev.map((t) =>
          t.id === currentThreadId
            ? {
                ...t,
                messages,
                lastTableData: data.lastTableData ?? t.lastTableData ?? null,
                jobId: data.jobId !== undefined ? data.jobId : t.jobId,
                agentNotes: data.agentNotes ?? t.agentNotes,
              }
            : t,
        );
      });
    } catch {
      // ignore errors - thread will remain with current state
    }
  }, [baseUrl, token, currentThreadId, threadsLoadedFromBackend, useMock]);

  useEffect(() => {
    loadThreadData();
  }, [loadThreadData]);

  const handleAgentEvent = useCallback((event: AssistantAgentEvent) => {
    setAgentEvents((prev) => {
      const next = [...prev, event];
      return next.length > 50 ? next.slice(-50) : next;
    });
  }, []);

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
    if (useMock) {
      const thread = createNewThread();
      setThreads((prev) => [...prev, thread]);
      setCurrentThreadId(thread.id);
      return;
    }
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
              jobId: (created as { jobId?: string | null }).jobId ?? null,
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
    !useMock &&
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
          <AssistantThreadSidebar
            isMobile={isMobile}
            threads={threads}
            currentThreadId={currentThreadId}
            threadsLoading={threadsLoading}
            threadsLoadedFromBackend={threadsLoadedFromBackend}
            onSelectThread={setCurrentThreadId}
            onNewThread={handleNewThread}
          />
          <AssistantChatColumn
            isMobile={isMobile}
            agentEvents={agentEvents}
            threads={threads}
            currentThread={currentThread}
            currentThreadId={currentThreadId}
            threadsLoading={threadsLoading}
            threadsLoadedFromBackend={threadsLoadedFromBackend}
            editingThreadName={editingThreadName}
            onSelectThread={handleSelectThread}
            onThreadNameChange={handleThreadNameChange}
            onThreadNameFocusChange={setEditingThreadName}
            onMessagesChange={handleMessagesChange}
            onTableData={(data) => handleTableData(data)}
            onMessageComplete={loadThreadData}
            onAgentEvent={handleAgentEvent}
          />
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
