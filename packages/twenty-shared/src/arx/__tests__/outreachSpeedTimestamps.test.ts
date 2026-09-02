import {
  applyOutreachAnalyticsEvent,
  buildCandidateAnalyticsUpdate,
  buildOutreachAnalyticsMetrics,
  computeTimeBucket,
  mergeLegacyCandidateFieldsIntoAnalytics,
  resolveOutreachFirstOutboundAt,
} from '../outreachAnalytics';

describe('outreachAnalytics', () => {
  it('computes first-contact and meeting buckets from enrolled baseline', () => {
    const flatMetrics = buildOutreachAnalyticsMetrics({
      enrolledAt: '2026-01-01T00:00:00.000Z',
      connectionSentAt: '2026-01-02T00:00:00.000Z',
      connectionAcceptedAt: '2026-01-03T00:00:00.000Z',
      firstContactAt: '2026-01-03T00:00:00.000Z',
      meetingBookedAt: '2026-01-10T00:00:00.000Z',
    });

    expect(flatMetrics.daysToFirstContact).toBe(2);
    expect(flatMetrics.timeToFirstContactBucket).toBe('D1_3');
    expect(flatMetrics.daysToMeetingBooked).toBe(9);
    expect(flatMetrics.timeToMeetingBucket).toBe('D7_14');
    expect(flatMetrics.daysFromConnectionToAccept).toBe(1);
    expect(flatMetrics.daysFromConnectionToMeeting).toBe(8);
  });

  it('stamps outbound and inbound touch timestamps in JSON', () => {
    const afterOutbound = applyOutreachAnalyticsEvent({
      existing: null,
      event: 'connection_sent',
      nowIso: '2026-01-01T10:00:00.000Z',
      enrolledAt: '2026-01-01T00:00:00.000Z',
    });

    expect(afterOutbound.firstOutboundAt).toBe('2026-01-01T10:00:00.000Z');
    expect(afterOutbound.lastOutboundAt).toBe('2026-01-01T10:00:00.000Z');
    expect(afterOutbound.firstContactAt).toBeNull();

    const afterInbound = applyOutreachAnalyticsEvent({
      existing: afterOutbound,
      event: 'inbound_reply_flush',
      nowIso: '2026-01-02T10:00:00.000Z',
    });

    expect(afterInbound.firstOutboundAt).toBe('2026-01-01T10:00:00.000Z');
    expect(afterInbound.lastOutboundAt).toBe('2026-01-01T10:00:00.000Z');
    expect(afterInbound.firstInboundAt).toBe('2026-01-02T10:00:00.000Z');
    expect(afterInbound.lastInboundAt).toBe('2026-01-02T10:00:00.000Z');
  });

  it('stamps connection accept without overwriting existing timestamps', () => {
    const firstPass = applyOutreachAnalyticsEvent({
      existing: null,
      event: 'connection_sent',
      nowIso: '2026-01-01T10:00:00.000Z',
      enrolledAt: '2026-01-01T00:00:00.000Z',
    });
    const secondPass = applyOutreachAnalyticsEvent({
      existing: firstPass,
      event: 'connection_accepted',
      nowIso: '2026-01-04T10:00:00.000Z',
    });

    expect(secondPass.connectionSentAt).toBe('2026-01-01T10:00:00.000Z');
    expect(secondPass.connectionAcceptedAt).toBe('2026-01-04T10:00:00.000Z');
    expect(secondPass.firstContactAt).toBe('2026-01-04T10:00:00.000Z');

    const flatMetrics = buildOutreachAnalyticsMetrics(secondPass);

    expect(flatMetrics.daysToFirstContact).toBe(3);
    expect(flatMetrics.daysFromConnectionToAccept).toBe(3);
  });

  it('builds candidate update payload with outreachAnalytics only', () => {
    const update = buildCandidateAnalyticsUpdate({
      existingAnalytics: {
        enrolledAt: '2026-01-01T00:00:00.000Z',
        connectionSentAt: '2026-01-02T00:00:00.000Z',
        firstOutboundAt: '2026-01-02T00:00:00.000Z',
        lastOutboundAt: '2026-01-02T00:00:00.000Z',
      },
      event: 'meeting_booked',
      nowIso: '2026-01-08T00:00:00.000Z',
    });

    expect(update).toEqual({
      outreachAnalytics: expect.objectContaining({
        meetingBookedAt: '2026-01-08T00:00:00.000Z',
        firstOutboundAt: '2026-01-02T00:00:00.000Z',
        lastOutboundAt: '2026-01-08T00:00:00.000Z',
        daysFromConnectionToMeeting: 6,
        timeToMeetingBucket: 'D3_7',
      }),
    });
    expect(update).not.toHaveProperty('lastOutboundAt');
    expect(update).not.toHaveProperty('outreachSpeedTimestamps');
  });

  it('backfills from legacy flat touch fields', () => {
    const analytics = mergeLegacyCandidateFieldsIntoAnalytics({
      createdAt: '2026-01-01T00:00:00.000Z',
      firstOutboundAt: '2026-01-02T12:00:00.000Z',
      lastOutboundAt: '2026-01-09T12:00:00.000Z',
      lastInboundAt: '2026-01-05T12:00:00.000Z',
      outreachSequenceStage: 'MEETING_BOOKED',
    });

    expect(analytics.connectionSentAt).toBe('2026-01-02T12:00:00.000Z');
    expect(analytics.lastInboundAt).toBe('2026-01-05T12:00:00.000Z');
    expect(analytics.meetingBookedAt).toBe('2026-01-09T12:00:00.000Z');
    expect(analytics.daysToFirstContact).toBeNull();
    expect(computeTimeBucket(analytics.daysToMeetingBooked)).toBe('D7_14');
  });

  it('resolves first outbound from JSON before flat fallback', () => {
    expect(
      resolveOutreachFirstOutboundAt(
        { firstOutboundAt: '2026-01-03T00:00:00.000Z' },
        '2026-01-01T00:00:00.000Z',
      ),
    ).toBe('2026-01-03T00:00:00.000Z');
  });
});
