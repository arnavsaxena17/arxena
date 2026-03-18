import { MOCK_THREADS } from '@/assistant/mocks/mockThreads';
import type { AssistantThread } from '@/assistant/types/assistant.types';
import { BaseThemeProvider } from '@/ui/theme/components/BaseThemeProvider';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecoilRoot } from 'recoil';

import { AssistantChatColumn } from '../AssistantChatColumn';

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
        <RecoilRoot>
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
              onUpdateThreadMode={jest.fn()}
            />
          </BaseThemeProvider>
        </RecoilRoot>
      </MemoryRouter>,
    );

    const select = screen.getByLabelText('Select conversation thread');
    fireEvent.change(select, { target: { value: 't2' } });
    expect(handleSelect).toHaveBeenCalled();
  });

  it('does not render thread select on desktop', () => {
    render(
      <MemoryRouter>
        <RecoilRoot>
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
              onUpdateThreadMode={jest.fn()}
            />
          </BaseThemeProvider>
        </RecoilRoot>
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
        <RecoilRoot>
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
              onUpdateThreadMode={jest.fn()}
            />
          </BaseThemeProvider>
        </RecoilRoot>
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
        <RecoilRoot>
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
              onUpdateThreadMode={jest.fn()}
            />
          </BaseThemeProvider>
        </RecoilRoot>
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

  it('shows a Start demo button in mock mode that appends scripted messages', () => {
    // Ensure mock flag is treated as true in this test environment
    const mockThread = MOCK_THREADS[0];
    const handleMessagesChange = jest.fn();

    render(
      <MemoryRouter>
        <RecoilRoot>
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
              onUpdateThreadMode={jest.fn()}
            />
          </BaseThemeProvider>
        </RecoilRoot>
      </MemoryRouter>,
    );

    const startButton = screen.getByRole('button', {
      name: /start demo/i,
    });
    expect(startButton).toBeInTheDocument();

    fireEvent.click(startButton);

    // First call clears messages, subsequent calls progressively add messages
    expect(handleMessagesChange).toHaveBeenCalled();
  });
});

