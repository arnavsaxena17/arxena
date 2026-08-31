import {
  applyOutreachActionTimestamps,
  backfillOutreachActionTimestampsFromCandidate,
  buildCandidateActionTimestampsUpdate,
  buildOutreachSpeedFlatMetrics,
  computeTimeBucket,
  resolveOutreachFirstOutboundAt,
} from '../outreachSpeedTimestamps';

describe('outreachSpeedTimestamps', () => {
  it('computes first-contact and meeting buckets from enrolled baseline', () => {
    const flatMetrics = buildOutreachSpeedFlatMetrics({
      enrolledAt: '2026-01-01T00:00:00.000Z',
      connectionSentAt: '2026-01-03T00:00:00.000Z',
      firstContactAt: '2026-01-03T00:00:00.000Z',
      meetingBookedAt: '2026-01-10T00:00:00.000Z',
    });

    expect(flatMetrics.daysToFirstContact).toBe(2);
    expect(flatMetrics.timeToFirstContactBucket).toBe('D1_3');
    expect(flatMetrics.daysToMeetingBooked).toBe(9);
    expect(flatMetrics.timeToMeetingBucket).toBe('D7_14');
    expect(flatMetrics.daysFromConnectionToAccept).toBeNull();
    expect(flatMetrics.daysFromConnectionToMeeting).toBe(7);
  });

  it('stamps outbound and inbound touch timestamps in JSON', () => {
    const afterOutbound = applyOutreachActionTimestamps({
      existing: null,
      event: 'connection_sent',
      nowIso: '2026-01-01T10:00:00.000Z',
      enrolledAt: '2026-01-01T00:00:00.000Z',
    });

    expect(afterOutbound.firstOutboundAt).toBe('2026-01-01T10:00:00.000Z');
    expect(afterOutbound.lastOutboundAt).toBe('2026-01-01T10:00:00.000Z');

    const afterInbound = applyOutreachActionTimestamps({
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
    const firstPass = applyOutreachActionTimestamps({
      existing: null,
      event: 'connection_sent',
      nowIso: '2026-01-01T10:00:00.000Z',
      enrolledAt: '2026-01-01T00:00:00.000Z',
    });
    const secondPass = applyOutreachActionTimestamps({
      existing: firstPass,
      event: 'connection_accepted',
      nowIso: '2026-01-04T10:00:00.000Z',
    });

    expect(secondPass.connectionSentAt).toBe('2026-01-01T10:00:00.000Z');
    expect(secondPass.connectionAcceptedAt).toBe('2026-01-04T10:00:00.000Z');

    const flatMetrics = buildOutreachSpeedFlatMetrics(secondPass);

    expect(flatMetrics.daysFromConnectionToAccept).toBe(3);
  });

  it('builds candidate update payload with JSON and flat touch mirrors', () => {
    const update = buildCandidateActionTimestampsUpdate({
      existingTimestamps: {
        enrolledAt: '2026-01-01T00:00:00.000Z',
        connectionSentAt: '2026-01-02T00:00:00.000Z',
        firstOutboundAt: '2026-01-02T00:00:00.000Z',
        lastOutboundAt: '2026-01-02T00:00:00.000Z',
      },
      event: 'meeting_booked',
      nowIso: '2026-01-08T00:00:00.000Z',
    });

    expect(update.outreachSpeedTimestamps.meetingBookedAt).toBe(
      '2026-01-08T00:00:00.000Z',
    );
    expect(update.lastOutboundAt).toBe('2026-01-08T00:00:00.000Z');
    expect(update.firstOutboundAt).toBe('2026-01-02T00:00:00.000Z');
    expect(update.daysFromConnectionToMeeting).toBe(6);
    expect(update.timeToMeetingBucket).toBe('D3_7');
  });

  it('backfills from legacy flat touch fields', () => {
    const update = backfillOutreachActionTimestampsFromCandidate({
      createdAt: '2026-01-01T00:00:00.000Z',
      firstOutboundAt: '2026-01-02T12:00:00.000Z',
      lastOutboundAt: '2026-01-09T12:00:00.000Z',
      lastInboundAt: '2026-01-05T12:00:00.000Z',
      outreachSequenceStage: 'MEETING_BOOKED',
    });

    expect(update.outreachSpeedTimestamps.connectionSentAt).toBe(
      '2026-01-02T12:00:00.000Z',
    );
    expect(update.outreachSpeedTimestamps.lastInboundAt).toBe(
      '2026-01-05T12:00:00.000Z',
    );
    expect(update.outreachSpeedTimestamps.meetingBookedAt).toBe(
      '2026-01-09T12:00:00.000Z',
    );
    expect(update.daysToFirstContact).toBe(2);
    expect(computeTimeBucket(update.daysToMeetingBooked)).toBe('D7_14');
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
