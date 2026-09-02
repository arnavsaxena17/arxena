import { StepStatus } from 'twenty-shared/workflow';

import { getWorkflowRunStepInfoToDisplayAsOutput } from '@/workflow/workflow-steps/utils/getWorkflowRunStepInfoToDisplayAsOutput';

describe('getWorkflowRunStepInfoToDisplayAsOutput', () => {
  it('replaces LinkedIn rate-limit pending metadata with human-readable fields', () => {
    const toLocaleStringSpy = jest
      .spyOn(Date.prototype, 'toLocaleString')
      .mockReturnValue('Aug 25, 2026, 12:16 PM');

    const output = getWorkflowRunStepInfoToDisplayAsOutput({
      stepInfo: {
        status: StepStatus.PENDING,
        waitMs: 80_240_104,
        scheduledAt: '2026-08-25T06:46:10.335Z',
        pendingReason: 'linkedin_rate_limit',
        result: {
          waitMs: 80_240_104,
          scheduledAt: '2026-08-25T06:46:10.335Z',
          pendingReason: 'linkedin_rate_limit',
        },
      },
    });

    expect(output).toMatchObject({
      reason: 'LinkedIn rate limit',
      retryAt: 'Aug 25, 2026, 12:16 PM',
    });
    expect(output).not.toHaveProperty('waitMs');
    expect(output).not.toHaveProperty('pendingReason');
    expect((output as { message?: string }).message).toContain(
      'LinkedIn search is rate limited',
    );

    toLocaleStringSpy.mockRestore();
  });

  it('replaces outreach send-window pending metadata with human-readable fields', () => {
    const toLocaleStringSpy = jest
      .spyOn(Date.prototype, 'toLocaleString')
      .mockReturnValue('Sep 2, 2026, 11:02 AM');
    const nowMs = Date.parse('2026-09-02T05:22:00.000Z');
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(nowMs);

    const output = getWorkflowRunStepInfoToDisplayAsOutput({
      stepInfo: {
        status: StepStatus.PENDING,
        waitMs: 50_400_000,
        scheduledAt: '2026-09-02T05:32:00.000Z',
        pendingReason: 'outreach_send_window',
        result: {
          waitMs: 50_400_000,
          scheduledAt: '2026-09-02T05:32:00.000Z',
          pendingReason: 'outreach_send_window',
          method: 'connection_request',
        },
      },
    });

    expect(output).toMatchObject({
      reason: 'Outside send window',
      retryAt: 'Sep 2, 2026, 11:02 AM',
      retryIn: '10 minutes',
    });
    expect(output).not.toHaveProperty('waitMs');
    expect(output).not.toHaveProperty('pendingReason');
    expect((output as { message?: string }).message).toContain(
      'LinkedIn connection request will run automatically',
    );

    dateNowSpy.mockRestore();
    toLocaleStringSpy.mockRestore();
  });

  it('strips status and history from ordinary step output', () => {
    const output = getWorkflowRunStepInfoToDisplayAsOutput({
      stepInfo: {
        status: StepStatus.SUCCESS,
        history: [],
        result: { people: [{ name: 'Ada' }] },
      },
    });

    expect(output).toEqual({
      result: { people: [{ name: 'Ada' }] },
    });
  });
});
