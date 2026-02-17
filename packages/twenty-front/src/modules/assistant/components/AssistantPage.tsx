import { AssistantResultsPanel } from '@/assistant/components/AssistantResultsPanel';
import { McpClientChat } from '@/assistant/components/McpClientChat';
import type { AssistantTableData } from '@/assistant/components/AssistantDetailsTable';
import type { AssistantThread } from '@/assistant/types/assistant.types';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { AppPath } from '@/types/AppPath';
import { PageBody } from '@/ui/layout/page/components/PageBody';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import { useIsMobile } from '@/ui/utilities/responsive/hooks/useIsMobile';
import styled from '@emotion/styled';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { Button, H2Title } from 'twenty-ui';
import { getAppPath } from '~/utils/navigation/getAppPath';

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
  min-width: 0;
  ${({ isMobile }) =>
    isMobile
      ? 'min-height: 40%; max-height: 60%;'
      : 'flex: 0 0 420px; max-width: 480px;'}
  border-right: ${({ isMobile, theme }) =>
    isMobile ? 'none' : `1px solid ${theme.border.color.medium}`};
  border-bottom: ${({ isMobile, theme }) =>
    isMobile ? `1px solid ${theme.border.color.medium}` : 'none'};
`;

const StyledThreadSelector = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2, 4)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.medium};
  flex-shrink: 0;
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

  useEffect(() => {
    if (threads.length > 0 && !threads.some((t) => t.id === currentThreadId)) {
      setCurrentThreadId(threads[0].id);
    }
  }, [threads, currentThreadId]);

  useEffect(() => {
    if (!baseUrl || !token || threadsLoadedFromBackend) return;
    let cancelled = false;
    setThreadsLoading(true);
    const loadFromBackend = async () => {
      try {
        const res = await fetch(`${baseUrl}/assistant/threads`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (!res.ok) return;
        const data = (await res.json()) as { threads?: Array<{ id: string; name: string }>; error?: string };
        if (data.error || !Array.isArray(data.threads)) return;
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
          if (cancelled) return;
          if (!createRes.ok) return;
          const created = (await createRes.json()) as { id?: string; name?: string };
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
      } catch {
        if (!cancelled) setThreadsLoadedFromBackend(true);
      } finally {
        if (!cancelled) setThreadsLoading(false);
      }
    };
    loadFromBackend();
    return () => {
      cancelled = true;
    };
  }, [token, threadsLoadedFromBackend]);

  useEffect(() => {
    saveThreadsToStorage(threads);
  }, [threads]);

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
          if (created.id) {
            const thread: AssistantThread = {
              id: created.id,
              name: created.name ?? 'New thread',
              messages: [],
              lastTableData: null,
            };
            setThreads((prev) => [...prev, thread]);
            setCurrentThreadId(created.id);
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
      <SubMenuTopBarContainer
        links={[
          { children: 'Assistant', href: getAppPath(AppPath.Assistant) },
          { children: 'Jobs', href: getAppPath(AppPath.Jobs) },
          { children: 'Candidates', href: getAppPath(AppPath.Jobs) },
          { children: 'Org chart', href: getAppPath(AppPath.OrgChart) },
        ]}
      >
        <H2Title title="Assistant" />
      </SubMenuTopBarContainer>
      <StyledPageBody>
        <StyledSplitLayout isMobile={isMobile}>
          <StyledChatPanel isMobile={isMobile}>
            <StyledThreadSelector aria-busy={threadsLoading}>
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
                disabled={threadsLoading}
              />
            </StyledThreadSelector>
            {currentThread && (
              <McpClientChat
                messages={currentThread.messages}
                onMessagesChange={handleMessagesChange}
                onTableData={handleTableData}
                threadId={currentThreadId || undefined}
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
