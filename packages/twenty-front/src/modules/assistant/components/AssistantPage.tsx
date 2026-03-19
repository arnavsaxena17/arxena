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
import { Loader } from '@ui/feedback/loader/components/Loader';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { Button, IconMessage, IconPlus } from 'twenty-ui';

function createNewThread(name = 'New thread'): AssistantThread {
  return {
    id: crypto.randomUUID(),
    name,
    messages: [],
    lastTableData: null,
    assistantMode: 'permissioned',
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

const StyledSmallInlineLoader = styled.div`
  display: flex;
  align-items: center;
  transform: scale(0.65);
  transform-origin: center;
`;

const useMockAssistant = (): boolean =>
  USE_MOCK_ASSISTANT || !(process.env.REACT_APP_SERVER_BASE_URL ?? '');

export const AssistantPage = () => {
  const baseUrl = process.env.REACT_APP_SERVER_BASE_URL ?? '';
  const isMobile = useIsMobile();
  const tokenPair = useRecoilValue(tokenPairState);
  const token = tokenPair?.accessToken?.token;
  const useMock = useMockAssistant();
  const [agentEvents, setAgentEvents] = useState<AssistantAgentEvent[]>([]);
  const [threads, setThreads] = useState<AssistantThread[]>(() =>
    USE_MOCK_ASSISTANT ? MOCK_THREADS.map((t) => ({ ...t })) : [],
  );
  const [currentThreadId, setCurrentThreadId] = useState<string>(() =>
    USE_MOCK_ASSISTANT && MOCK_THREADS.length > 0 ? MOCK_THREADS[0].id : '',
  );
  const [threadsLoadedFromBackend, setThreadsLoadedFromBackend] = useState(USE_MOCK_ASSISTANT);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [isCreatingNewThread, setIsCreatingNewThread] = useState(false);
  const [editingThreadName, setEditingThreadName] = useState(false);
  const [threadPatchInFlightById, setThreadPatchInFlightById] = useState<Record<string, boolean>>(
    {},
  );

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
          threads?: Array<{
            id: string;
            name: string;
            jobId?: string | null;
            job?: { id: string; name?: string; jobLocation?: string; company?: { id: string; name?: string } } | null;
            assistantMode?: 'fully_autonomous' | 'permissioned';
          }>;
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
            body: JSON.stringify({ name: 'New thread', assistantMode: 'permissioned' }),
          });
          if (cancelled) {
            setThreadsLoading(false);
            return;
          }
          if (!createRes.ok) {
            setThreadsLoading(false);
            return;
          }
          const created = (await createRes.json()) as {
            id?: string;
            name?: string;
            jobId?: string | null;
            assistantMode?: 'fully_autonomous' | 'permissioned';
          };
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
                jobId: created.jobId ?? null,
                assistantMode: created.assistantMode ?? 'permissioned',
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
              job: t.job ?? null,
              assistantMode: t.assistantMode ?? 'permissioned',
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
  }, [baseUrl, token, threadsLoadedFromBackend]);

  // When running fully in mock mode (no backend), keep threads in local storage.
  useEffect(() => {
    if (!useMock) return;
    try {
      localStorage.setItem('assistant_threads', JSON.stringify(threads));
    } catch {
      // ignore storage errors
    }
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
        job?: { id: string; name?: string; jobLocation?: string; company?: { id: string; name?: string } } | null;
        agentNotes?: Array<{ summary: string; createdAt?: string; id?: string }>;
        agentEvents?: AssistantAgentEvent[];
        assistantMode?: 'fully_autonomous' | 'permissioned';
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
                job: data.job !== undefined ? data.job : t.job,
                agentNotes: data.agentNotes ?? t.agentNotes,
                agentEvents: data.agentEvents ?? t.agentEvents,
                assistantMode: data.assistantMode ?? t.assistantMode ?? 'permissioned',
              }
            : t,
        );
      });
      setAgentEvents(data.agentEvents ?? []);
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

  useEffect(() => {
    if (useMock && currentThread?.agentEvents && currentThread.agentEvents.length > 0) {
      setAgentEvents(currentThread.agentEvents);
    }
  }, [useMock, currentThread]);

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

  const handleNewThread = useCallback(
    async (e?: React.MouseEvent<HTMLButtonElement>) => {
      if (e) {
        // Prevent rapid double-clicks from triggering multiple create requests.
        e.currentTarget.disabled = true;
      }

      let shouldProceed = false;
      setIsCreatingNewThread((prev) => {
        if (prev) return prev;
        shouldProceed = true;
        return true;
      });

      if (!shouldProceed) return;

      try {
        if (useMock) {
          const thread = createNewThread();
          setThreads((prev) => [thread, ...prev]);
          setCurrentThreadId(thread.id);
          setAgentEvents([]);
          return;
        }

        if (baseUrl && token) {
          try {
            const res = await fetch(`${baseUrl}/assistant/threads`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ name: 'New thread', assistantMode: 'permissioned' }),
            });

            if (res.ok) {
              const created = (await res.json()) as {
                id?: string;
                name?: string;
                jobId?: string | null;
                assistantMode?: 'fully_autonomous' | 'permissioned';
              };
              const threadId = created.id;
              if (threadId) {
                const thread: AssistantThread = {
                  id: threadId,
                  name: created.name ?? 'New thread',
                  messages: [],
                  lastTableData: null,
                  jobId: created.jobId ?? null,
                  assistantMode: created.assistantMode ?? 'permissioned',
                };
                setThreads((prev) => [thread, ...prev]);
                setCurrentThreadId(threadId);
                setAgentEvents([]);
                return;
              }
            }
          } catch {
            // fall through to local
          }
        }

        const thread = createNewThread();
        setThreads((prev) => [thread, ...prev]);
        setCurrentThreadId(thread.id);
        setAgentEvents([]);
      } finally {
        setIsCreatingNewThread(false);
      }
    },
    [baseUrl, token, useMock],
  );

  const deleteThread = useCallback(
    async (threadId: string) => {
      if (!threadId) return;

      // Optimistic local delete when running without a backend.
      if (useMock) {
        const nextThreads = threads.filter((t) => t.id !== threadId);
        setThreads(nextThreads);

        setAgentEvents([]);
        setEditingThreadName(false);

        if (currentThreadId === threadId) {
          if (nextThreads.length === 0) {
            await handleNewThread();
            return;
          }
          setCurrentThreadId(nextThreads[0].id);
        }

        return;
      }

      if (!baseUrl || !token) return;

      setThreadsLoading(true);
      try {
        const res = await fetch(`${baseUrl}/assistant/threads/${threadId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) return;

        const delData = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        if (delData?.error) return;

        const listRes = await fetch(`${baseUrl}/assistant/threads`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!listRes.ok) return;

        const data = (await listRes.json()) as {
          threads?: Array<{
            id: string;
            name: string;
            jobId?: string | null;
            job?: {
              id: string;
              name?: string;
              jobLocation?: string;
              company?: { id: string; name?: string };
            } | null;
            assistantMode?: 'fully_autonomous' | 'permissioned';
          }>;
          error?: string;
        };

        if (data.error || !Array.isArray(data.threads)) return;
        if (data.threads.length === 0) {
          // Keep UX consistent: always show at least one thread.
          // Remove the deleted thread from local state first so we don't briefly show it
          // alongside the newly created thread (fixes "deleted thread added to new thread").
          setThreads((prev) => prev.filter((t) => t.id !== threadId));
          setAgentEvents([]);
          setEditingThreadName(false);
          await handleNewThread();
          return;
        }

        const nextThreads: AssistantThread[] = data.threads.map((t) => ({
          id: t.id,
          name: t.name,
          messages: [],
          lastTableData: null,
          jobId: t.jobId ?? null,
          job: t.job ?? null,
          assistantMode: t.assistantMode ?? 'permissioned',
        }));

        setThreads(nextThreads);
        setCurrentThreadId(nextThreads[0].id);
        setAgentEvents([]);
        setEditingThreadName(false);
      } catch {
        // best-effort delete; ignore errors
      } finally {
        setThreadsLoading(false);
      }
    },
    [useMock, threads, currentThreadId, baseUrl, token, handleNewThread],
  );

  const patchThread = useCallback(
    async (
      threadId: string,
      patch: { assistantMode?: 'fully_autonomous' | 'permissioned'; jobId?: string | null; name?: string },
    ) => {
      // Optimistic update so UI reflects changes immediately (e.g. attach job after JD upload)
      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId
            ? {
                ...t,
                ...(patch.assistantMode ? { assistantMode: patch.assistantMode } : {}),
                ...(patch.jobId !== undefined
                  ? { jobId: patch.jobId, job: patch.jobId ? t.job : null }
                  : {}),
                ...(typeof patch.name === 'string' ? { name: patch.name } : {}),
              }
            : t,
        ),
      );

      if (!baseUrl || !token || !threadsLoadedFromBackend) {
        return;
      }

      const refetchThread = async () => {
        try {
          const res = await fetch(`${baseUrl}/assistant/threads/${threadId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) return;
          const data = (await res.json()) as {
            jobId?: string | null;
            job?: { id: string; name?: string; jobLocation?: string; company?: { id: string; name?: string } } | null;
            assistantMode?: 'fully_autonomous' | 'permissioned';
            name?: string;
            error?: string;
          };
          if (data.error) return;
          setThreads((prev) =>
            prev.map((t) =>
              t.id === threadId
                ? {
                    ...t,
                    ...(typeof data.name === 'string' ? { name: data.name } : {}),
                    ...(data.jobId !== undefined ? { jobId: data.jobId } : {}),
                    ...(data.job !== undefined ? { job: data.job } : {}),
                    ...(data.assistantMode ? { assistantMode: data.assistantMode } : {}),
                  }
                : t,
            ),
          );
        } catch {
          // ignore; best effort refresh
        }
      };

      setThreadPatchInFlightById((prev) => ({ ...prev, [threadId]: true }));
      try {
        const res = await fetch(`${baseUrl}/assistant/threads/${threadId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(patch),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          id?: string;
          name?: string;
          jobId?: string | null;
          assistantMode?: 'fully_autonomous' | 'permissioned';
          error?: string;
        };
        if (data.error) return;

        setThreads((prev) =>
          prev.map((t) =>
            t.id === threadId
              ? {
                  ...t,
                  ...(typeof data.name === 'string' ? { name: data.name } : {}),
                  ...(data.jobId !== undefined ? { jobId: data.jobId, job: null } : {}),
                  ...(data.assistantMode ? { assistantMode: data.assistantMode } : {}),
                }
              : t,
          ),
        );

        if ('jobId' in patch) {
          await refetchThread();
        }
      } catch {
        // ignore; best effort
      } finally {
        setThreadPatchInFlightById((prev) => ({ ...prev, [threadId]: false }));
      }
    },
    [baseUrl, token, threadsLoadedFromBackend],
  );

  const handleSelectThread = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      if (value === '__new__') {
        handleNewThread();
        return;
      }
      setAgentEvents([]);
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
    },
    [currentThreadId],
  );

  const handleThreadNameFocusChange = useCallback(
    (isEditing: boolean) => {
      setEditingThreadName(isEditing);

      if (
        isEditing ||
        !baseUrl ||
        !token ||
        !threadsLoadedFromBackend ||
        !currentThreadId
      ) {
        return;
      }

      const thread = threads.find((t) => t.id === currentThreadId);
      if (!thread) {
        return;
      }

      const name = thread.name;
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
    },
    [baseUrl, token, threadsLoadedFromBackend, currentThreadId, threads],
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

  const handleSelectThreadById = useCallback(
    (threadId: string) => {
      setAgentEvents([]);
      setCurrentThreadId(threadId);
    },
    [],
  );

  return (
    <StyledPageContainer>
      <StyledPageHeader title="Assistant" Icon={IconMessage}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button
            title="New thread"
            Icon={IconPlus}
            variant="primary"
            onClick={handleNewThread}
            disabled={isCreatingNewThread || (threadsLoading && threadsLoadedFromBackend)}
          />
          {isCreatingNewThread ? (
            <StyledSmallInlineLoader data-testid="assistant-new-thread-loader-header" role="status">
              <Loader color="gray" />
            </StyledSmallInlineLoader>
          ) : null}
        </div>
      </StyledPageHeader>
      <StyledPageBody>
        <StyledSplitLayout isMobile={isMobile}>
          <AssistantThreadSidebar
            isMobile={isMobile}
            threads={threads}
            currentThreadId={currentThreadId}
            threadsLoading={threadsLoading}
            threadsLoadedFromBackend={threadsLoadedFromBackend}
            onSelectThread={handleSelectThreadById}
            onNewThread={handleNewThread}
            isCreatingNewThread={isCreatingNewThread}
            onPatchThread={patchThread}
            threadPatchInFlightById={threadPatchInFlightById}
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
            onThreadNameFocusChange={handleThreadNameFocusChange}
            onMessagesChange={handleMessagesChange}
            onTableData={(data) => handleTableData(data)}
            onMessageComplete={loadThreadData}
            onAgentEvent={handleAgentEvent}
            onDeleteThread={deleteThread}
            onPatchThread={patchThread}
            onUpdateThreadMode={(threadId, assistantMode) =>
              patchThread(threadId, { assistantMode })
            }
          />
          <AssistantResultsPanel
            tableData={currentThread?.lastTableData ?? null}
            maxTableHeight={600}
            threadId={showSync ? currentThreadId ?? undefined : undefined}
            onSync={showSync ? handleSyncTable : undefined}
            jobIdFromThread={currentThread?.jobId ?? null}
          />
        </StyledSplitLayout>
      </StyledPageBody>
    </StyledPageContainer>
  );
};
