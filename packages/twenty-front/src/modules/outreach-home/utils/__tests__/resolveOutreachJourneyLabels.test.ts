import {
  resolveOutreachNextRetryAt,
  resolveOutreachNextRetryLabel,
  resolveOutreachNextStepLabel,
  resolveOutreachPendingStepLabel,
} from '@/outreach-home/utils/resolveOutreachJourneyLabels';

describe('resolveOutreachJourneyLabels', () => {
  const rateLimitedRun = {
    currentStepName: 'Send LinkedIn connection',
    currentStepKind: 'RATE_LIMITED',
    resumeAt: '2026-09-03T16:45:00.000Z',
    pendingReason: 'linkedin_rate_limit',
  };

  it('should show the pending step and retry time when LinkedIn rate limited', () => {
    expect(resolveOutreachPendingStepLabel(rateLimitedRun)).toBe(
      'Send LinkedIn connection · rate limited',
    );
    expect(resolveOutreachNextRetryAt(rateLimitedRun)).toBe(
      '2026-09-03T16:45:00.000Z',
    );
    expect(resolveOutreachNextRetryLabel(rateLimitedRun)).toBe(
      new Date('2026-09-03T16:45:00.000Z').toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    );
    expect(resolveOutreachNextStepLabel(rateLimitedRun)).toContain(
      'Send LinkedIn connection · rate limited · retry',
    );
  });

  it('should include retry time for delay and send-window waits', () => {
    expect(
      resolveOutreachNextStepLabel({
        currentStepName: 'Wait 3 days',
        currentStepKind: 'DELAY',
        resumeAt: '2026-09-06T10:00:00.000Z',
        pendingReason: null,
      }),
    ).toContain('Wait 3 days · retry');

    expect(
      resolveOutreachPendingStepLabel({
        currentStepName: 'Send LinkedIn message',
        currentStepKind: 'PENDING',
        pendingReason: 'outreach_send_window',
      }),
    ).toBe('Send LinkedIn message · send window');
  });

  it('should not show a retry time while paused or waiting for approval', () => {
    expect(
      resolveOutreachNextRetryAt({
        currentStepKind: 'PENDING',
        resumeAt: '2026-09-03T16:45:00.000Z',
        pendingReason: 'outreach_project_paused',
      }),
    ).toBeNull();

    expect(
      resolveOutreachNextRetryAt({
        currentStepKind: 'FORM',
        resumeAt: '2026-09-03T16:45:00.000Z',
        pendingReason: null,
      }),
    ).toBeNull();

    expect(
      resolveOutreachPendingStepLabel({
        currentStepName: 'Review opener',
        currentStepKind: 'FORM',
        pendingReason: null,
      }),
    ).toBe('Needs approval');
  });
});
