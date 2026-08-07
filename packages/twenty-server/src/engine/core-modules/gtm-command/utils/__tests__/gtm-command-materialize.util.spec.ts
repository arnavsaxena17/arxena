import {
  advanceFunnelStage,
  buildCandidateEventUpdate,
  computeAttentionReason,
  computeCoverageBucket,
  computeDaysBetween,
  computeTimeBucket,
  funnelStageForEvent,
  mapMessagingChannelToGtmChannel,
  mapOutboundStageForChannel,
} from 'src/engine/core-modules/gtm-command/utils/gtm-command-materialize.util';

describe('gtm-command-materialize.util', () => {
  it('computes coverage buckets', () => {
    expect(computeCoverageBucket(0)).toBe('ZERO');
    expect(computeCoverageBucket(1)).toBe('ONE_TWO');
    expect(computeCoverageBucket(2)).toBe('ONE_TWO');
    expect(computeCoverageBucket(3)).toBe('THREE_PLUS');
  });

  it('advances funnel stages monotonically', () => {
    expect(advanceFunnelStage('ADDED', 'REACHED')).toBe('REACHED');
    expect(advanceFunnelStage('COVERED', 'REACHED')).toBe('COVERED');
    expect(advanceFunnelStage('REACHED', 'REPLIED')).toBe('REPLIED');
    expect(advanceFunnelStage('REPLIED', 'MEETING_BOOKED')).toBe(
      'MEETING_BOOKED',
    );
    expect(funnelStageForEvent('outbound_message')).toBe('REACHED');
    expect(funnelStageForEvent('inbound_reply')).toBe('REPLIED');
  });

  it('maps messaging channels to outbound stages', () => {
    expect(mapMessagingChannelToGtmChannel('whatsapp-unipile')).toBe(
      'WHATSAPP',
    );
    expect(mapMessagingChannelToGtmChannel('linkedin-inmail')).toBe('INMAIL');
    expect(mapMessagingChannelToGtmChannel('linkedin')).toBe('OTHER');
    expect(mapMessagingChannelToGtmChannel('linkedin-connect')).toBe(
      'LINKEDIN_CONNECT',
    );
    expect(mapOutboundStageForChannel('whatsapp-unipile')).toBe(
      'WHATSAPP_SENT',
    );
    expect(mapOutboundStageForChannel('linkedin-inmail')).toBe('INMAIL_SENT');
    expect(mapOutboundStageForChannel('email')).toBe('EMAIL_SENT');
    expect(mapOutboundStageForChannel('linkedin')).toBeNull();
  });

  it('builds candidate event updates', () => {
    expect(
      buildCandidateEventUpdate({
        event: 'connection_sent',
        nowIso: '2026-01-01T00:00:00.000Z',
      }),
    ).toMatchObject({
      outreachSequenceStage: 'CONNECTION_SENT',
      connectionStatus: 'SENT',
      firstOutboundAt: '2026-01-01T00:00:00.000Z',
    });

    expect(
      buildCandidateEventUpdate({
        event: 'outbound_message',
        messagingChannel: 'linkedin-inmail',
        nowIso: '2026-01-01T00:00:00.000Z',
        existingFirstOutboundAt: '2025-12-01T00:00:00.000Z',
      }),
    ).toMatchObject({
      outreachSequenceStage: 'INMAIL_SENT',
      lastOutboundAt: '2026-01-01T00:00:00.000Z',
    });

    expect(
      buildCandidateEventUpdate({
        event: 'enrich_failed',
        nowIso: '2026-01-01T00:00:00.000Z',
      }),
    ).toMatchObject({
      outreachSequenceStage: 'FAILED_ENRICH',
      enrichStatus: 'FAILED',
    });
  });

  it('computes attention reasons', () => {
    expect(
      computeAttentionReason({
        connectionStatus: 'IGNORED',
      }),
    ).toBe('CONNECT_IGNORE');
    expect(
      computeAttentionReason({
        enrichStatus: 'FAILED',
      }),
    ).toBe('ENRICH_MISS');
  });

  it('computes day buckets', () => {
    expect(computeTimeBucket(0)).toBe('UNDER_1D');
    expect(computeTimeBucket(2)).toBe('D1_3');
    expect(computeTimeBucket(5)).toBe('D3_7');
    expect(computeTimeBucket(10)).toBe('D7_14');
    expect(computeTimeBucket(20)).toBe('OVER_14D');
  });

  it('computes days between timestamps', () => {
    expect(
      computeDaysBetween(
        '2026-01-01T00:00:00.000Z',
        '2026-01-11T00:00:00.000Z',
      ),
    ).toBe(10);
  });
});
