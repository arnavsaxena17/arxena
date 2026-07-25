import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';

import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { projectIdAtom, projectsState } from '@/candidate-table/states/states';
import { jotaiStore } from '@/ui/utilities/state/jotai/jotaiStore';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

import { BaseThemeProvider } from '@/ui/theme/components/BaseThemeProvider';

import type { ContextResultItem } from '../../types';
import { OrgChartOutreachModal } from '../OrgChartOutreachModal';

const ProjectIdProbe = () => {
  const projectId = useAtomStateValue(projectIdAtom);
  return <div data-testid="job-id-probe">{projectId}</div>;
};

const mockRefetchJobs = jest.fn().mockResolvedValue(undefined);
const mockEnqueueSnackBar = jest.fn();

jest.mock('@/candidate-table/hooks/useProjectRefetch', () => ({
  useProjectRefetch: () => ({ refetchJobs: mockRefetchJobs }),
}));

jest.mock('@/ui/feedback/snack-bar-manager/hooks/useSnackBar', () => ({
  useSnackBar: () => ({
    enqueueSuccessSnackBar: mockEnqueueSnackBar,
    enqueueErrorSnackBar: mockEnqueueSnackBar,
    enqueueInfoSnackBar: mockEnqueueSnackBar,
    enqueueWarningSnackBar: mockEnqueueSnackBar,
  }),
}));

jest.mock('@/websocket-context/hooks/useUploadProgressSseSession', () => ({
  useUploadProgressSseSession: () => ({
    beginUploadProgressSseSession: jest.fn(),
    endUploadProgressSseSessionAfterDelay: jest.fn(),
  }),
}));

jest.mock('../../utils/orgChartUtils', () => {
  const actual = jest.requireActual('../../utils/orgChartUtils') as Record<
    string,
    unknown
  >;
  return {
    ...actual,
    uploadOrgChartCandidatesToJob: jest.fn().mockResolvedValue({ ok: true }),
    pollCandidateIdOnJob: jest.fn().mockResolvedValue(null),
  };
});

const contextItem: ContextResultItem = {
  id: 'c1',
  fullName: 'Jane Doe',
  headline: 'VP Eng',
  linkedinUrl: 'https://www.linkedin.com/in/janedoe',
  email: 'jane@example.com',
  phone: '+15550001',
  company: 'Acme',
  raw: {},
};

const initializeState = () => {
  jotaiStore.set(tokenPairState.atom, {
    accessToken: { token: 'test-token', expiresAt: '' },
    refreshToken: { token: 'r', expiresAt: '' },
  } as never);
  jotaiStore.set(currentWorkspaceMemberState.atom, { id: 'wm-1' } as never);
  jotaiStore.set(projectsState.atom, [
    {
      id: 'job-a',
      name: 'Open role',
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
    },
  ]);
  jotaiStore.set(projectIdAtom.atom, 'job-a');
};

jest.mock('~/config', () => ({
  REACT_APP_SERVER_BASE_URL: 'http://localhost:3000',
}));

describe('OrgChartOutreachModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    }) as jest.Mock;
    initializeState();
  });

  it('updates message textarea when template selection changes', async () => {
    console.log('OrgChartOutreachModal: template change test start');
    render(
      <JotaiProvider store={jotaiStore}>
        <BaseThemeProvider>
          <OrgChartOutreachModal
            isOpen
            onClose={jest.fn()}
            channel="linkedin_invite"
            contextItem={contextItem}
            node={null}
            companyName="Acme"
          />
        </BaseThemeProvider>
      </JotaiProvider>,
    );

    const templateSelect = screen.getByTestId('orgchart-outreach-template-select');
    const message = screen.getByTestId('orgchart-outreach-message') as HTMLTextAreaElement;

    expect(message.value).toContain('connect');

    fireEvent.change(templateSelect, { target: { value: 'li_recruiter' } });
    await waitFor(() => {
      expect(message.value).toContain('opportunity');
    });
    console.log('OrgChartOutreachModal: template change test done', message.value);
  });

  it('shows subject field for email channel', () => {
    console.log('OrgChartOutreachModal: email subject visible');
    render(
      <JotaiProvider store={jotaiStore}>
        <BaseThemeProvider>
          <OrgChartOutreachModal
            isOpen
            onClose={jest.fn()}
            channel="email"
            contextItem={contextItem}
            node={null}
          />
        </BaseThemeProvider>
      </JotaiProvider>,
    );
    expect(screen.getByTestId('orgchart-outreach-subject')).toBeInTheDocument();
  });

  it('persists selected job as active job', async () => {
    console.log('OrgChartOutreachModal: job selection persists to jotai');
    jotaiStore.set(projectsState.atom, [
      {
        id: 'job-a',
        name: 'Open role',
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'job-b',
        name: 'Another role',
        isActive: true,
        createdAt: '2024-01-02T00:00:00Z',
      },
    ]);
    jotaiStore.set(projectIdAtom.atom, 'job-a');

    render(
      <JotaiProvider store={jotaiStore}>
        <BaseThemeProvider>
          <ProjectIdProbe />
          <OrgChartOutreachModal
            isOpen
            onClose={jest.fn()}
            channel="linkedin_invite"
            contextItem={contextItem}
            node={null}
            companyName="Acme"
          />
        </BaseThemeProvider>
      </JotaiProvider>,
    );

    expect(screen.getByTestId('job-id-probe').textContent).toBe('job-a');

    const jobSelect = screen.getByTestId('orgchart-outreach-job-select');
    fireEvent.change(jobSelect, { target: { value: 'job-b' } });

    await waitFor(() => {
      expect(screen.getByTestId('job-id-probe').textContent).toBe('job-b');
    });
  });
});
