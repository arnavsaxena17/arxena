import { MOCK_THREADS } from '@/assistant/mocks/mockThreads';
import type { AssistantThread } from '@/assistant/types/assistant.types';
import { BaseThemeProvider } from '@/ui/theme/components/BaseThemeProvider';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider as JotaiProvider } from 'jotai';
import { TextEncoder } from 'util';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { jotaiStore } from '@/ui/utilities/state/jotai/jotaiStore';
import type { AuthTokenPair } from '~/generated-metadata/graphql';
import { cookieStorage } from '~/utils/cookie-storage';
import { AssistantChatColumn } from '../AssistantChatColumn';

if (typeof globalThis.ResizeObserver === 'undefined') {
  // handsontable uses ResizeObserver; mock it for this Jest environment.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
  // handsontable uses IntersectionObserver; mock it for this Jest environment.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).IntersectionObserver = class {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(_callback: any) {}
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof globalThis.HTMLElement !== 'undefined') {
  // McpClientChat tries to scroll; JSDOM doesn't implement it.
  (globalThis.HTMLElement.prototype as any).scrollIntoView ??= jest.fn();
}

const makeThread = (
  id: string,
  name: string,
  messages: AssistantThread['messages'] = [],
): AssistantThread => ({
  id,
  name,
  messages,
  lastTableData: null,
});

describe('AssistantChatColumn', () => {
  const baseThread = makeThread('t1', 'Thread A');

  it('shows thread select on mobile and calls onSelectThread', () => {
    const handleSelect = jest.fn();
    const threads = [baseThread, makeThread('t2', 'Thread B')];

    render(
      <MemoryRouter>
        <JotaiProvider store={jotaiStore}>
          <BaseThemeProvider>
            <AssistantChatColumn
              isMobile
              agentEvents={[]}
              threads={threads}
              currentThread={baseThread}
              currentThreadId="t1"
              threadsLoading={false}
              threadsLoadedFromBackend
              editingThreadName={false}
              onSelectThread={handleSelect}
              onThreadNameChange={jest.fn()}
              onThreadNameFocusChange={jest.fn()}
              onMessagesChange={jest.fn()}
              onTableData={jest.fn()}
              onMessageComplete={jest.fn()}
              onAgentEvent={jest.fn()}
              onDeleteThread={jest.fn()}
              onPatchThread={jest.fn()}
              onUpdateThreadMode={jest.fn()}
            />
          </BaseThemeProvider>
        </JotaiProvider>
      </MemoryRouter>,
    );

    const select = screen.getByLabelText('Select conversation thread');
    fireEvent.change(select, { target: { value: 't2' } });
    expect(handleSelect).toHaveBeenCalled();
  });

  it('does not render thread select on desktop', () => {
    render(
      <MemoryRouter>
        <JotaiProvider store={jotaiStore}>
          <BaseThemeProvider>
            <AssistantChatColumn
              isMobile={false}
              agentEvents={[]}
              threads={[baseThread]}
              currentThread={baseThread}
              currentThreadId="t1"
              threadsLoading={false}
              threadsLoadedFromBackend
              editingThreadName={false}
              onSelectThread={jest.fn()}
              onThreadNameChange={jest.fn()}
              onThreadNameFocusChange={jest.fn()}
              onMessagesChange={jest.fn()}
              onTableData={jest.fn()}
              onMessageComplete={jest.fn()}
              onAgentEvent={jest.fn()}
              onDeleteThread={jest.fn()}
              onPatchThread={jest.fn()}
              onUpdateThreadMode={jest.fn()}
            />
          </BaseThemeProvider>
        </JotaiProvider>
      </MemoryRouter>,
    );

    expect(
      screen.queryByLabelText('Select conversation thread'),
    ).not.toBeInTheDocument();
  });

  it('shows and updates thread name input', () => {
    const handleNameChange = jest.fn();

    render(
      <MemoryRouter>
        <JotaiProvider store={jotaiStore}>
          <BaseThemeProvider>
            <AssistantChatColumn
              isMobile
              agentEvents={[]}
              threads={[baseThread]}
              currentThread={baseThread}
              currentThreadId="t1"
              threadsLoading={false}
              threadsLoadedFromBackend
              editingThreadName={false}
              onSelectThread={jest.fn()}
              onThreadNameChange={handleNameChange}
              onThreadNameFocusChange={jest.fn()}
              onMessagesChange={jest.fn()}
              onTableData={jest.fn()}
              onMessageComplete={jest.fn()}
              onAgentEvent={jest.fn()}
              onDeleteThread={jest.fn()}
              onPatchThread={jest.fn()}
              onUpdateThreadMode={jest.fn()}
            />
          </BaseThemeProvider>
        </JotaiProvider>
      </MemoryRouter>,
    );

    const input = screen.getByPlaceholderText('Thread name') as HTMLInputElement;
    expect(input.value).toBe('Thread A');

    fireEvent.change(input, { target: { value: 'Renamed thread' } });
    expect(handleNameChange).toHaveBeenCalledWith('Renamed thread');
  });

  it('renders a mock recruiter/client flow thread with messages and notes', () => {
    const mockThread = MOCK_THREADS[0];

    render(
      <MemoryRouter>
        <JotaiProvider store={jotaiStore}>
          <BaseThemeProvider>
            <AssistantChatColumn
              isMobile={false}
              agentEvents={[]}
              threads={MOCK_THREADS}
              currentThread={mockThread}
              currentThreadId={mockThread.id}
              threadsLoading={false}
              threadsLoadedFromBackend
              editingThreadName={false}
              onSelectThread={jest.fn()}
              onThreadNameChange={jest.fn()}
              onThreadNameFocusChange={jest.fn()}
              onMessagesChange={jest.fn()}
              onTableData={jest.fn()}
              onMessageComplete={jest.fn()}
              onAgentEvent={jest.fn()}
              onDeleteThread={jest.fn()}
              onPatchThread={jest.fn()}
              onUpdateThreadMode={jest.fn()}
            />
          </BaseThemeProvider>
        </JotaiProvider>
      </MemoryRouter>,
    );

    // Recruiter–assistant conversation from mock thread is visible
    expect(
      screen.getByText(/Senior React developers in Bangalore, 5\+ years experience\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Product only, fintech or SaaS preferred\./i),
    ).toBeInTheDocument();

    // Agent notes from mock thread are rendered in the notes panel
    expect(
      screen.getByText(/Client persona: prefers hands-on tech lead, product companies;/i),
    ).toBeInTheDocument();
  });

  it('shows a Start demo button in mock mode that appends scripted messages', async () => {
    // Ensure mock flag is treated as true in this test environment
    const mockThread = MOCK_THREADS[0];
    const handleMessagesChange = jest.fn();
    const nowIso = new Date().toISOString();
    const dummyTokenPair: AuthTokenPair = {
      accessOrWorkspaceAgnosticToken: {
        token: 'mock-access-token',
        expiresAt: nowIso,
      },
      refreshToken: {
        token: 'mock-refresh-token',
        expiresAt: nowIso,
      },
    };

    const encoder = new TextEncoder();
    const messageSseChunk1 =
      'event: message\ndata: {"chatMessage":"Demo assistant message"}\n';
    const messageSseChunk2 = '\n';

    // Mock demo stream endpoint; other fetch calls (agent log, etc.) can be no-ops.
    const fetchMock = jest.fn((url: unknown) => {
      const urlStr = typeof url === 'string' ? url : '';
      if (urlStr.includes('/demo-thread/stream')) {
        let chunkIndex = 0;
        return Promise.resolve({
          ok: true,
          body: {
            getReader: () => ({
              read: async () => {
                if (chunkIndex === 0) {
                  chunkIndex += 1;
                  return {
                    done: false,
                    value: encoder.encode(messageSseChunk1),
                  };
                }
                if (chunkIndex === 1) {
                  chunkIndex += 1;
                  return { done: false, value: encoder.encode(messageSseChunk2) };
                }

                return { done: true, value: undefined };
              },
            }),
          },
        });
      }

      return Promise.resolve({ ok: true });
    });

    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    cookieStorage.clear();
    jotaiStore.set(tokenPairState.atom, dummyTokenPair);

    render(
      <MemoryRouter>
        <JotaiProvider store={jotaiStore}>
          <BaseThemeProvider>
            <AssistantChatColumn
              isMobile={false}
              agentEvents={[]}
              threads={MOCK_THREADS}
              currentThread={mockThread}
              currentThreadId={mockThread.id}
              threadsLoading={false}
              threadsLoadedFromBackend
              editingThreadName={false}
              onSelectThread={jest.fn()}
              onThreadNameChange={jest.fn()}
              onThreadNameFocusChange={jest.fn()}
              onMessagesChange={handleMessagesChange}
              onTableData={jest.fn()}
              onMessageComplete={jest.fn()}
              onAgentEvent={jest.fn()}
              onDeleteThread={jest.fn()}
              onPatchThread={jest.fn()}
              onUpdateThreadMode={jest.fn()}
            />
          </BaseThemeProvider>
        </JotaiProvider>
      </MemoryRouter>,
    );

    const startButton = screen.getByRole('button', {
      name: /start demo/i,
    });
    expect(startButton).toBeInTheDocument();

    fireEvent.click(startButton);

    await waitFor(() => {
      const streamCalled = fetchMock.mock.calls.some(([url]) => {
        const urlStr = typeof url === 'string' ? url : '';
        return urlStr.includes('/demo-thread/stream');
      });

      expect(streamCalled).toBe(true);
    });

    await waitFor(() => {
      const stopButton = screen.getByRole('button', { name: /stop demo/i });
      expect(stopButton).toBeInTheDocument();
    });
  });
});

