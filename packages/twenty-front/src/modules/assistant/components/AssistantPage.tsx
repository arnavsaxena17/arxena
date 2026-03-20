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
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { Button, IconMessage, IconPlus } from 'twenty-ui';

// ── localStorage persistence helpers ────────────────────────────────────────
// Only lightweight refs (no rows/columns) are stored locally.
// Actual table data is fetched from the backend Redis cache on reload.
type PersistedTableRef = {
  idx: number;
  tables: Array<{ tableId: string; label?: string; count?: number; tableType?: string }>;
};

function mergeTableColumns(
  currentColumns: string[],
  incomingColumns: string[],
): string[] {
  const mergedColumns = [...currentColumns];

  for (const column of incomingColumns) {
    if (!mergedColumns.includes(column)) {
      mergedColumns.push(column);
    }
  }

  return mergedColumns;
}

function saveThreadTablesLocal(threadId: string, messages: AssistantChatMessage[]) {
  const refs: PersistedTableRef[] = messages
    .map((m, idx) => {
      const list = m.tableDataList;
      if (!list || list.length === 0) return null;
      const tables = list
        .map((t) => {
          const tableId = t.tableId ?? '';
          if (!tableId) return null;
          const item: PersistedTableRef['tables'][number] = { tableId };
          if (t.label !== undefined) item.label = t.label;
          if (t.rows !== undefined) item.count = t.rows.length;
          if (t.tableType !== undefined) item.tableType = t.tableType;
          return item;
        })
        .filter((t): t is PersistedTableRef['tables'][number] => t !== null);
      if (tables.length === 0) return null;
      return { idx, tables };
    })
    .filter((x): x is PersistedTableRef => x !== null);
  try {
    localStorage.setItem(`thread_tablerefs_v1_${threadId}`, JSON.stringify(refs));
  } catch { /* ignore quota errors */ }
}

function loadThreadTableRefsLocal(threadId: string): PersistedTableRef[] {
  try {
    const raw = localStorage.getItem(`thread_tablerefs_v1_${threadId}`);
    if (!raw) return [];
    return JSON.parse(raw) as PersistedTableRef[];
  } catch {
    return [];
  }
}

function saveThreadEventsLocal(threadId: string, events: AssistantAgentEvent[]) {
  try {
    localStorage.setItem(`thread_events_v1_${threadId}`, JSON.stringify(events));
  } catch { /* ignore quota errors */ }
}

function loadThreadEventsLocal(threadId: string): AssistantAgentEvent[] {
  try {
    const raw = localStorage.getItem(`thread_events_v1_${threadId}`);
    if (!raw) return [];
    return JSON.parse(raw) as AssistantAgentEvent[];
  } catch {
    return [];
  }
}
// ────────────────────────────────────────────────────────────────────────────

function createNewThread(name = 'New thread'): AssistantThread {
  return {
    id: crypto.randomUUID(),
    name,
    messages: [],
    lastTableData: null,
    assistantMode: 'permissioned',
    searchType: 'classic',
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
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  // Ref so async callbacks always read the latest currentThreadId without
  // becoming stale closures that omit themselves from the dep array.
  const currentThreadIdRef = useRef(currentThreadId);
  useEffect(() => { currentThreadIdRef.current = currentThreadId; }, [currentThreadId]);

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
            body: JSON.stringify({
              name: 'New thread',
              assistantMode: 'permissioned',
              searchType: 'classic',
            }),
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
              searchType:
                (created as { searchType?: 'classic' | 'sales_navigator' | 'recruiter' })
                  .searchType ?? 'classic',
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
              searchType: (t as { searchType?: 'classic' | 'sales_navigator' | 'recruiter' }).searchType ?? 'classic',
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
            toolResults?: Array<{ content: string }>;
            tableReferences?: Array<{
              tableId: string;
              ref: string;
              tableType?: string;
              label?: string;
              count?: number;
              columns?: string[];
              createdAt?: number;
            }>;
          }>;
          lastTableData?: AssistantTableData;
          assistantParameters?: Record<string, unknown> | null;
          assistantSearchStrategy?: Record<string, unknown> | null;
          jobId?: string | null;
          job?: { id: string; name?: string; jobLocation?: string; company?: { id: string; name?: string } } | null;
          agentNotes?: Array<{ summary: string; createdAt?: string; id?: string }>;
          agentEvents?: AssistantAgentEvent[];
          assistantMode?: 'fully_autonomous' | 'permissioned';
          searchType?: 'classic' | 'sales_navigator' | 'recruiter';
          error?: string;
      };
      if (data.error) return;

      const messagesFromApi = data.messages ?? [];
      const frontendMessages: AssistantChatMessage[] = messagesFromApi.map((m) => ({
        role: m.role,
        content: m.content,
        toolCalls: m.toolCalls,
        toolResults: m.toolResults,
        tableReferences: m.tableReferences,
      }));

      // Restore per-message table data: prefer backend-persisted table refs,
      // then fall back to localStorage for older threads.
      const tableRefsFromMessages: PersistedTableRef[] = frontendMessages
        .map((m, idx) => {
          const tables = (m.tableReferences ?? [])
            .map((t) => {
              if (!t.tableId) return null;
              const item: PersistedTableRef['tables'][number] = { tableId: t.tableId };
              if (t.label !== undefined) item.label = t.label;
              if (t.count !== undefined) item.count = t.count;
              if (t.tableType !== undefined) item.tableType = t.tableType;
              return item;
            })
            .filter((t): t is PersistedTableRef['tables'][number] => t !== null);
          if (tables.length === 0) return null;
          return { idx, tables };
        })
        .filter((x): x is PersistedTableRef => x !== null);
      const tableRefs =
        tableRefsFromMessages.length > 0
          ? tableRefsFromMessages
          : loadThreadTableRefsLocal(currentThreadId);
      if (tableRefs.length > 0 && baseUrl && token) {
        await Promise.all(
          tableRefs.map(async ({ idx, tables }) => {
            if (idx >= frontendMessages.length || !frontendMessages[idx]) return;
            const fetched = await Promise.all(
              tables.map(async ({ tableId, label, tableType }) => {
                if (!tableId) return null;
                try {
                  const res = await fetch(
                    `${baseUrl}/assistant/threads/${currentThreadId}/tables/${tableId}`,
                    { headers: { Authorization: `Bearer ${token}` } },
                  );
                  if (!res.ok) return null;
                  const d = (await res.json()) as {
                    columns?: string[];
                    rows?: Record<string, unknown>[];
                    error?: string;
                  };
                  if (d.error || !d.columns || !d.rows) return null;
                  return {
                    columns: d.columns,
                    rows: d.rows,
                    tableId,
                    label,
                    tableType,
                  } as AssistantTableData;
                } catch {
                  return null;
                }
              }),
            );
            const resolved = fetched.filter((t): t is AssistantTableData => t !== null);
            if (resolved.length > 0) {
              frontendMessages[idx] = { ...frontendMessages[idx], tableDataList: resolved };
            }
          }),
        );
      } else if (data.lastTableData) {
        // Fallback: no refs saved yet — attach the single backend table to last assistant msg.
        const lastAssistantIdx = frontendMessages.findLastIndex(
          (m) => m.role === 'assistant',
        );
        if (lastAssistantIdx >= 0) {
          frontendMessages[lastAssistantIdx] = {
            ...frontendMessages[lastAssistantIdx],
            tableDataList: [data.lastTableData],
          };
        }
      }

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
                assistantParameters: data.assistantParameters ?? t.assistantParameters,
                assistantSearchStrategy:
                  data.assistantSearchStrategy ?? t.assistantSearchStrategy,
                jobId: data.jobId !== undefined ? data.jobId : t.jobId,
                job: data.job !== undefined ? data.job : t.job,
                agentNotes: data.agentNotes ?? t.agentNotes,
                agentEvents: data.agentEvents ?? t.agentEvents,
                assistantMode: data.assistantMode ?? t.assistantMode ?? 'permissioned',
                searchType: data.searchType ?? t.searchType ?? 'recruiter',
              }
            : t,
        );
      });

      // Restore agent events: prefer backend data, fall back to localStorage.
      const backendEvents = data.agentEvents ?? [];
      const localEvents = loadThreadEventsLocal(currentThreadId);
      const restoredEvents =
        backendEvents.length > 0
          ? backendEvents
          : localEvents;
      setAgentEvents(restoredEvents);
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
      const capped = next.length > 50 ? next.slice(-50) : next;
      // Persist so summaries survive page reloads.
      const tid = currentThreadIdRef.current;
      if (tid) saveThreadEventsLocal(tid, capped);
      return capped;
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
    (messages: AssistantChatMessage[]) => {
      const tid = currentThreadIdRef.current;
      if (!tid) return;
      setThreads((prev) =>
        prev.map((t) =>
          t.id === tid ? { ...t, messages } : t,
        ),
      );
      // Persist per-message table data so it survives page reloads.
      saveThreadTablesLocal(tid, messages);
    },
    [],
  );

  const handleTableData = useCallback(
    (data: AssistantTableData) => {
      if (!currentThreadId) return;
      setThreads((prev) =>
        prev.map((t) =>
          t.id === currentThreadId
            ? {
                ...t,
                lastTableData:
                  t.lastTableData?.tableType === 'candidates' &&
                  data.tableType === 'candidates'
                    ? {
                        ...t.lastTableData,
                        ...data,
                        columns: mergeTableColumns(
                          t.lastTableData.columns,
                          data.columns,
                        ),
                        rows:
                          t.lastTableData.tableId &&
                          data.tableId &&
                          t.lastTableData.tableId === data.tableId
                            ? data.rows
                            : [...t.lastTableData.rows, ...data.rows],
                      }
                    : data,
              }
            : t,
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
              body: JSON.stringify({
                name: 'New thread',
                assistantMode: 'permissioned',
                searchType: 'recruiter',
              }),
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
                  searchType: (created as { searchType?: 'classic' | 'sales_navigator' | 'recruiter' }).searchType ?? 'recruiter',
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
      patch: {
        assistantMode?: 'fully_autonomous' | 'permissioned';
        jobId?: string | null;
        name?: string;
        searchType?: 'classic' | 'sales_navigator' | 'recruiter';
      },
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
                ...(patch.searchType ? { searchType: patch.searchType } : {}),
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
          searchType?: 'classic' | 'sales_navigator' | 'recruiter';
          assistantParameters?: Record<string, unknown> | null;
          assistantSearchStrategy?: Record<string, unknown> | null;
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
                  ...(data.searchType ? { searchType: data.searchType } : {}),
                  ...(data.assistantParameters !== undefined
                    ? { assistantParameters: data.assistantParameters ?? undefined }
                    : {}),
                  ...(data.assistantSearchStrategy !== undefined
                    ? { assistantSearchStrategy: data.assistantSearchStrategy ?? undefined }
                    : {}),
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
          searchType?: 'classic' | 'sales_navigator' | 'recruiter';
          assistantParameters?: Record<string, unknown> | null;
          assistantSearchStrategy?: Record<string, unknown> | null;
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
                  ...(data.searchType ? { searchType: data.searchType } : {}),
                  ...(data.assistantParameters !== undefined
                    ? { assistantParameters: data.assistantParameters ?? undefined }
                    : {}),
                  ...(data.assistantSearchStrategy !== undefined
                    ? { assistantSearchStrategy: data.assistantSearchStrategy ?? undefined }
                    : {}),
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

  // Called when the MCP assistant creates a job (via create_job tool) and emits
  // job_attached SSE. Optimistically links the job to the current thread and
  // persists it to the backend via patchThread.
  const handleJobAttached = useCallback(
    (jobId: string) => {
      if (!currentThreadId) return;
      patchThread(currentThreadId, { jobId });
    },
    [currentThreadId, patchThread],
  );

  const handleSelectThread = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value;
      if (value === '__new__') {
        handleNewThread();
        return;
      }
      const localEvents = loadThreadEventsLocal(value);
      setAgentEvents(localEvents);
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
      // Restore persisted events immediately (loadThreadData will also restore,
      // but this avoids a flicker while the fetch is in-flight).
      const localEvents = loadThreadEventsLocal(threadId);
      setAgentEvents(localEvents);
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
            onJobAttached={handleJobAttached}
            selectedCandidateIds={selectedCandidateIds}
          />
          <AssistantResultsPanel
            tableData={currentThread?.lastTableData ?? null}
            maxTableHeight={600}
            threadId={showSync ? currentThreadId ?? undefined : undefined}
            onSync={showSync ? handleSyncTable : undefined}
            jobIdFromThread={currentThread?.jobId ?? null}
            onSelectionChange={setSelectedCandidateIds}
          />
        </StyledSplitLayout>
      </StyledPageBody>
    </StyledPageContainer>
  );
};
