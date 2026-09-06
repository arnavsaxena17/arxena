import {
  resolveOutreachJourneyStageLabel,
  resolveOutreachJourneyTimelineStageId,
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
    ).toBe('Review opener');
  });

  it('should surface failed workflow step errors', () => {
    expect(
      resolveOutreachPendingStepLabel({
        currentStepName: 'Fetch LinkedIn messages',
        currentStepKind: 'FAILED',
        pendingReason: null,
        errorMessage: 'Attendee not found',
        status: 'FAILED',
      }),
    ).toBe('Fetch LinkedIn messages · Attendee not found');
  });

  it('should prefer follow-up count over bare CONNECTION_ACCEPTED for Stage', () => {
    expect(
      resolveOutreachJourneyStageLabel({
        outreachSequenceStage: 'CONNECTION_ACCEPTED',
        linkedinFollowUpCount: 0,
      }),
    ).toBe('Connection accepted');

    expect(
      resolveOutreachJourneyStageLabel({
        outreachSequenceStage: 'CONNECTION_ACCEPTED',
        linkedinFollowUpCount: 2,
      }),
    ).toBe('Followed up 2');

    expect(
      resolveOutreachJourneyTimelineStageId({
        outreachSequenceStage: 'CONNECTION_ACCEPTED',
        linkedinFollowUpCount: 3,
      }),
    ).toBe('FOLLOW_UP_3');
  });

  it('should not treat FORM pending as a Stage label', () => {
    expect(
      resolveOutreachJourneyStageLabel({
        outreachSequenceStage: 'CONNECTION_ACCEPTED',
        linkedinFollowUpCount: 1,
        hasFormPending: true,
      }),
    ).toBe('Followed up 1');
  });

  it('should keep late CRM stages ahead of follow-up count', () => {
    expect(
      resolveOutreachJourneyTimelineStageId({
        outreachSequenceStage: 'REPLIED',
        linkedinFollowUpCount: 2,
      }),
    ).toBe('REPLIED');

    expect(
      resolveOutreachJourneyTimelineStageId({
        outreachSequenceStage: 'FAILED_NO_REPLY',
        linkedinFollowUpCount: 3,
      }),
    ).toBe('FAILED_NO_REPLY');

    expect(
      resolveOutreachJourneyTimelineStageId({
        outreachSequenceStage: 'REPLIED',
        linkedinFollowUpCount: 0,
        outreachConversationStage: 'MEETING_BOOKED',
      }),
    ).toBe('MEETING_BOOKED');
  });

  it('should replace generic Human in the Loop FORM names with Needs approval', () => {
    expect(
      resolveOutreachPendingStepLabel({
        currentStepName: 'Human in the Loop',
        currentStepKind: 'FORM',
        pendingReason: null,
      }),
    ).toBe('Needs approval');

    expect(
      resolveOutreachPendingStepLabel({
        currentStepName: 'Approve follow-up 3',
        currentStepKind: 'FORM',
        pendingReason: null,
      }),
    ).toBe('Approve follow-up 3');
  });
});
