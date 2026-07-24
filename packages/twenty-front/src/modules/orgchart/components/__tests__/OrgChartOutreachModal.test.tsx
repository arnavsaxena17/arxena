import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RecoilRoot, useRecoilValue, type MutableSnapshot } from 'recoil';

import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { jobIdAtom, jobsState } from '@/candidate-table/states/states';

import { BaseThemeProvider } from '@/ui/theme/components/BaseThemeProvider';

import type { ContextResultItem } from '../../types';
import { OrgChartOutreachModal } from '../OrgChartOutreachModal';

const JobIdProbe = () => {
  const jobId = useRecoilValue(jobIdAtom);
  return <div data-testid="job-id-probe">{jobId}</div>;
};

const mockRefetchJobs = jest.fn().mockResolvedValue(undefined);
const mockEnqueueSnackBar = jest.fn();

jest.mock('@/candidate-table/hooks/useJobRefetch', () => ({
  useJobRefetch: () => ({ refetchJobs: mockRefetchJobs }),
}));

jest.mock('@/ui/feedback/snack-bar-manager/hooks/useSnackBar', () => ({
  useSnackBar: () => ({ enqueueSnackBar: mockEnqueueSnackBar }),
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

const initializeState = ({ set }: MutableSnapshot) => {
  set(tokenPairState, {
    accessToken: { token: 'test-token', expiresAt: '' },
    refreshToken: { token: 'r', expiresAt: '' },
  } as never);
  set(currentWorkspaceMemberState, { id: 'wm-1' } as never);
  set(jobsState, [
    {
      id: 'job-a',
      name: 'Open role',
      isActive: true,
      createdAt: '2024-01-01T00:00:00Z',
    },
  ]);
  set(jobIdAtom, 'job-a');
};

describe('OrgChartOutreachModal', () => {
  const originalEnv = process.env.REACT_APP_SERVER_BASE_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.REACT_APP_SERVER_BASE_URL = 'http://localhost:3000';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    }) as jest.Mock;
  });

  afterEach(() => {
    process.env.REACT_APP_SERVER_BASE_URL = originalEnv;
  });

  it('updates message textarea when template selection changes', async () => {
    console.log('OrgChartOutreachModal: template change test start');
    render(
      <RecoilRoot initializeState={initializeState}>
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
      </RecoilRoot>,
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
      <RecoilRoot initializeState={initializeState}>
        <BaseThemeProvider>
          <OrgChartOutreachModal
            isOpen
            onClose={jest.fn()}
            channel="email"
            contextItem={contextItem}
            node={null}
          />
        </BaseThemeProvider>
      </RecoilRoot>,
    );
    expect(screen.getByTestId('orgchart-outreach-subject')).toBeInTheDocument();
  });

  it('persists selected job as active job', async () => {
    console.log('OrgChartOutreachModal: job selection persists to recoil');
    const initWithTwoJobs = ({ set }: MutableSnapshot) => {
      initializeState({ set } as MutableSnapshot);
      set(jobsState, [
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
      set(jobIdAtom, 'job-a');
    };

    render(
      <RecoilRoot initializeState={initWithTwoJobs}>
        <BaseThemeProvider>
          <JobIdProbe />
          <OrgChartOutreachModal
            isOpen
            onClose={jest.fn()}
            channel="linkedin_invite"
            contextItem={contextItem}
            node={null}
            companyName="Acme"
          />
        </BaseThemeProvider>
      </RecoilRoot>,
    );

    expect(screen.getByTestId('job-id-probe').textContent).toBe('job-a');

    const jobSelect = screen.getByTestId('orgchart-outreach-job-select');
    fireEvent.change(jobSelect, { target: { value: 'job-b' } });

    await waitFor(() => {
      expect(screen.getByTestId('job-id-probe').textContent).toBe('job-b');
    });
  });
});
