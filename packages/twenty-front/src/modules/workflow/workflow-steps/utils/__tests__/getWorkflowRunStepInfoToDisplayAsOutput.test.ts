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
