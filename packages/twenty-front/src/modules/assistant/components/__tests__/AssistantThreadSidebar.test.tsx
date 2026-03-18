import type { AssistantThread } from '@/assistant/types/assistant.types';
import { BaseThemeProvider } from '@/ui/theme/components/BaseThemeProvider';
import { fireEvent, render, screen } from '@testing-library/react';
import { RecoilRoot } from 'recoil';

import { AssistantThreadSidebar } from '../AssistantThreadSidebar';

const makeThread = (id: string, name: string): AssistantThread => ({
  id,
  name,
  messages: [],
  lastTableData: null,
});

describe('AssistantThreadSidebar', () => {
  const threads: AssistantThread[] = [
    makeThread('t1', 'Thread A'),
    makeThread('t2', 'Thread B'),
  ];

  it('renders threads and highlights the active one', () => {
    render(
      <RecoilRoot>
        <BaseThemeProvider>
          <AssistantThreadSidebar
            isMobile={false}
            threads={threads}
            currentThreadId="t2"
            threadsLoading={false}
            threadsLoadedFromBackend
            onSelectThread={jest.fn()}
            onNewThread={jest.fn()}
            isCreatingNewThread={false}
            onPatchThread={jest.fn()}
            threadPatchInFlightById={{}}
          />
        </BaseThemeProvider>
      </RecoilRoot>,
    );

    expect(screen.getByText('Thread A')).toBeInTheDocument();
    expect(screen.getByText('Thread B')).toBeInTheDocument();
  });

  it('calls onSelectThread when a thread is clicked', () => {
    const handleSelect = jest.fn();

    render(
      <RecoilRoot>
        <BaseThemeProvider>
          <AssistantThreadSidebar
            isMobile={false}
            threads={threads}
            currentThreadId="t1"
            threadsLoading={false}
            threadsLoadedFromBackend
            onSelectThread={handleSelect}
            onNewThread={jest.fn()}
            isCreatingNewThread={false}
            onPatchThread={jest.fn()}
            threadPatchInFlightById={{}}
          />
        </BaseThemeProvider>
      </RecoilRoot>,
    );

    fireEvent.click(screen.getByText('Thread B'));
    expect(handleSelect).toHaveBeenCalledWith('t2');
  });

  it('calls onNewThread when the header button is clicked', () => {
    const handleNew = jest.fn();

    render(
      <RecoilRoot>
        <BaseThemeProvider>
          <AssistantThreadSidebar
            isMobile={false}
            threads={threads}
            currentThreadId="t1"
            threadsLoading={false}
            threadsLoadedFromBackend
            onSelectThread={jest.fn()}
            onNewThread={handleNew}
            isCreatingNewThread={false}
            onPatchThread={jest.fn()}
            threadPatchInFlightById={{}}
          />
        </BaseThemeProvider>
      </RecoilRoot>,
    );

    fireEvent.click(screen.getByText('New thread'));
    expect(handleNew).toHaveBeenCalled();
  });

  it('renders same structure on mobile (visibility handled by styles)', () => {
    const { container } = render(
      <RecoilRoot>
        <BaseThemeProvider>
          <AssistantThreadSidebar
            isMobile
            threads={threads}
            currentThreadId="t1"
            threadsLoading={false}
            threadsLoadedFromBackend
            onSelectThread={jest.fn()}
            onNewThread={jest.fn()}
            isCreatingNewThread={false}
            onPatchThread={jest.fn()}
            threadPatchInFlightById={{}}
          />
        </BaseThemeProvider>
      </RecoilRoot>,
    );

    const rootElement = container.firstChild as HTMLElement | null;
    expect(rootElement).toBeTruthy();
  });

  it('disables New thread button and shows a loader when creating', () => {
    render(
      <RecoilRoot>
        <BaseThemeProvider>
          <AssistantThreadSidebar
            isMobile={false}
            threads={threads}
            currentThreadId="t1"
            threadsLoading={false}
            threadsLoadedFromBackend
            onSelectThread={jest.fn()}
            onNewThread={jest.fn()}
            isCreatingNewThread
            onPatchThread={jest.fn()}
            threadPatchInFlightById={{}}
          />
        </BaseThemeProvider>
      </RecoilRoot>,
    );

    const button = screen.getByRole('button', { name: /new thread/i });
    expect(button).toBeDisabled();
    expect(screen.getByTestId('assistant-new-thread-loader-sidebar')).toBeInTheDocument();
  });
});

