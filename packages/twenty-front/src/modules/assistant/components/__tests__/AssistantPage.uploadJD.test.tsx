import { BaseThemeProvider } from '@/ui/theme/components/BaseThemeProvider';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';
import { useEffect } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { jotaiStore } from '@/ui/utilities/state/jotai/jotaiStore';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { AssistantPage } from '../AssistantPage';

const baseUrl = 'http://test-server';

jest.mock('@/ui/utilities/responsive/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

jest.mock('@/object-metadata/hooks/useObjectMetadataItems', () => ({
  useObjectMetadataItems: () => ({
    objectMetadataItems: [{ nameSingular: 'project' }],
  }),
}));

jest.mock('@/object-record/hooks/useFindManyRecords', () => ({
  useFindManyRecords: () => ({
    records: [],
  }),
}));

jest.mock('@/arx-jd-upload/hooks/useArxJDUpload', () => ({
  useArxJDUpload: () => ({
    handleFileUpload: async () => 'job-1',
    handleFileRemoval: async () => {},
    isUploading: false,
  }),
}));

jest.mock('@/assistant/components/McpClientChat', () => ({
  McpClientChat: () => null,
}));

jest.mock('@/ui/layout/page/components/PageBody', () => ({
  PageBody: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/ui/layout/page/components/PageContainer', () => ({
  PageContainer: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/ui/layout/page/components/PageHeader', () => ({
  PageHeader: ({ children }: any) => <div>{children}</div>,
}));

const TestTokenInitializer = ({ token }: { token: string }) => {
  const set = useSetAtomState(tokenPairState);
  useEffect(() => {
    set({
      accessOrWorkspaceAgnosticToken: { token },
      refreshToken: { token: 'refresh' },
    } as any);
  }, [set, token]);
  return null;
};

jest.mock('~/config', () => ({
  REACT_APP_SERVER_BASE_URL: 'http://test-server',
}));

describe('AssistantPage upload JD hydration', () => {
  afterEach(() => {
    cleanup();
  });

  it('creates a new thread, uploads JD from thread menu, and shows attached job name', async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = (init?.method ?? 'GET').toUpperCase();

      if (url === `${baseUrl}/assistant/threads` && method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            threads: [
              { id: 't1', name: 'Thread 1', projectId: null, assistantMode: 'permissioned' },
            ],
          }),
        } as any;
      }

      if (url === `${baseUrl}/assistant/threads` && method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 't2',
            name: 'New thread',
            projectId: null,
            assistantMode: 'permissioned',
          }),
        } as any;
      }

      if (url === `${baseUrl}/assistant/threads/t2` && method === 'PATCH') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: 't2', projectId: 'job-1' }),
        } as any;
      }

      if (url === `${baseUrl}/assistant/threads/t2` && method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            projectId: 'job-1',
            job: { id: 'job-1', name: 'Account Executive', company: { id: 'c1', name: 'Acme' } },
          }),
        } as any;
      }

      return { ok: false, status: 500, json: async () => ({ error: 'not mocked' }) } as any;
    });

    (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    render(
      <MemoryRouter>
        <JotaiProvider store={jotaiStore}>
          <TestTokenInitializer token="token" />
          <BaseThemeProvider>
            <AssistantPage />
          </BaseThemeProvider>
        </JotaiProvider>
      </MemoryRouter>,
    );

    // Initial thread loaded
    expect(await screen.findByDisplayValue(/Thread 1/i)).toBeInTheDocument();

    // Create new thread
    const newThreadButtons = screen.getAllByRole('button', { name: /new thread/i });
    fireEvent.click(newThreadButtons[0]);
    expect(await screen.findByDisplayValue(/New thread/i)).toBeInTheDocument();

    // Open thread actions (3 dots) and choose Upload JD
    fireEvent.click(screen.getByTitle('Thread actions'));
    fireEvent.click(await screen.findByRole('button', { name: /upload jd/i }));

    // Upload a JD file (hidden input in AssistantJDSection)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    const jdFile = new File(['dummy jd'], 'jd.txt', { type: 'text/plain' });
    fireEvent.change(fileInput, { target: { files: [jdFile] } });

    // UI hydrates to show job name, not just "Project attached"
    await waitFor(() => {
      expect(screen.getByText(/Project: Account Executive/i)).toBeInTheDocument();
      expect(screen.getByText(/at Acme/i)).toBeInTheDocument();
    });

    // Sanity: we did both PATCH and refetch GET
    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/assistant/threads/t2`,
      expect.objectContaining({ method: 'PATCH' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/assistant/threads/t2`,
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
