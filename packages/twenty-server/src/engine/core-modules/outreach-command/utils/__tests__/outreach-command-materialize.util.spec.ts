import {
  advanceFunnelStage,
  buildCandidateEventUpdate,
  candidateStageImpliesConnectionRequestSent,
  candidateStageImpliesOutbound,
  computeAttentionReason,
  computeCoverageBucket,
  computeDaysBetween,
  computeTimeBucket,
  funnelStageForEvent,
  mapMessagingChannelToOutreachChannel,
  mapOutboundStageForChannel,
  rollupOutreachFunnelStage,
} from 'src/engine/core-modules/outreach-command/utils/outreach-command-materialize.util';

describe('outreach-command-materialize.util', () => {
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

  it('keeps Reached until 3 people are touched, then Covered', () => {
    expect(
      rollupOutreachFunnelStage({
        current: 'ADDED',
        event: 'connection_sent',
        peopleReached: 1,
      }),
    ).toBe('REACHED');
    expect(
      rollupOutreachFunnelStage({
        current: 'REACHED',
        event: 'connection_sent',
        peopleReached: 2,
      }),
    ).toBe('REACHED');
    expect(
      rollupOutreachFunnelStage({
        current: 'REACHED',
        event: 'connection_sent',
        peopleReached: 3,
      }),
    ).toBe('COVERED');
    expect(
      rollupOutreachFunnelStage({
        current: 'REPLIED',
        event: 'connection_sent',
        peopleReached: 3,
      }),
    ).toBe('REPLIED');
  });

  it('maps messaging channels to outbound stages', () => {
    expect(mapMessagingChannelToOutreachChannel('whatsapp-unipile')).toBe(
      'WHATSAPP',
    );
    expect(mapMessagingChannelToOutreachChannel('WHATSAPP_UNIPILE')).toBe(
      'WHATSAPP',
    );
    expect(mapMessagingChannelToOutreachChannel('linkedin-inmail')).toBe('INMAIL');
    expect(mapMessagingChannelToOutreachChannel('LINKEDIN_INMAIL')).toBe('INMAIL');
    expect(mapMessagingChannelToOutreachChannel('linkedin')).toBe(
      'LINKEDIN_CONNECT',
    );
    expect(mapMessagingChannelToOutreachChannel('LINKEDIN')).toBe(
      'LINKEDIN_CONNECT',
    );
    expect(mapMessagingChannelToOutreachChannel('linkedin-connect')).toBe(
      'LINKEDIN_CONNECT',
    );
    expect(mapMessagingChannelToOutreachChannel('linkedin_connect')).toBe(
      'LINKEDIN_CONNECT',
    );
    expect(mapMessagingChannelToOutreachChannel('LINKEDIN_CONNECT')).toBe(
      'LINKEDIN_CONNECT',
    );
    expect(mapOutboundStageForChannel('whatsapp-unipile')).toBe(
      'WHATSAPP_SENT',
    );
    expect(mapOutboundStageForChannel('linkedin-inmail')).toBe('INMAIL_SENT');
    expect(mapOutboundStageForChannel('email')).toBe('EMAIL_SENT');
    expect(mapOutboundStageForChannel('linkedin')).toBe('CONNECTION_SENT');
  });

  it('builds candidate event updates without flat touch timestamps', () => {
    expect(
      buildCandidateEventUpdate({
        event: 'connection_sent',
        nowIso: '2026-01-01T00:00:00.000Z',
      }),
    ).toMatchObject({
      outreachSequenceStage: 'CONNECTION_SENT',
      lastOutboundMessageKind: 'CONNECT_NOTE',
    });
    expect(
      buildCandidateEventUpdate({
        event: 'connection_sent',
        nowIso: '2026-01-01T00:00:00.000Z',
      }),
    ).not.toHaveProperty('firstOutboundAt');

    expect(
      buildCandidateEventUpdate({
        event: 'outbound_message',
        messagingChannel: 'linkedin-inmail',
        nowIso: '2026-01-01T00:00:00.000Z',
        existingFirstOutboundAt: '2025-12-01T00:00:00.000Z',
        outboundMessageKind: 'OPENER',
      }),
    ).toMatchObject({
      outreachSequenceStage: 'INMAIL_SENT',
      lastOutboundMessageKind: 'OPENER',
    });
    expect(
      buildCandidateEventUpdate({
        event: 'outbound_message',
        messagingChannel: 'linkedin-inmail',
        nowIso: '2026-01-01T00:00:00.000Z',
        existingFirstOutboundAt: '2025-12-01T00:00:00.000Z',
        outboundMessageKind: 'OPENER',
      }),
    ).not.toHaveProperty('lastOutboundAt');

    expect(
      buildCandidateEventUpdate({
        event: 'inbound_reply_flush',
        classifiedOutreachStage: 'DEFERRED',
        nowIso: '2026-01-01T00:00:00.000Z',
        existingLastOutboundMessageKind: 'CONNECT_NOTE',
      }),
    ).toMatchObject({
      outreachSequenceStage: 'DEFERRED',
      convertedOnMessageKind: 'CONNECT_NOTE',
    });
    expect(
      buildCandidateEventUpdate({
        event: 'inbound_reply_flush',
        classifiedOutreachStage: 'DEFERRED',
        nowIso: '2026-01-01T00:00:00.000Z',
        existingLastOutboundMessageKind: 'CONNECT_NOTE',
      }),
    ).not.toHaveProperty('lastInboundAt');
  });

  it('computes attention reasons', () => {
    expect(
      computeAttentionReason({
        outreachSequenceStage: 'CONNECTION_IGNORED',
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

  it('treats connection and later send stages as outbound', () => {
    expect(candidateStageImpliesOutbound('QUEUED')).toBe(false);
    expect(candidateStageImpliesOutbound('NEEDS_CONNECTION')).toBe(false);
    expect(candidateStageImpliesOutbound('CONNECTION_SENT')).toBe(true);
    expect(candidateStageImpliesOutbound('CONNECTION_IGNORED')).toBe(true);
    expect(candidateStageImpliesOutbound('EMAIL_SENT')).toBe(true);
  });

  it('treats CONNECTION_SENT and CONNECTION_ACCEPTED as already invited', () => {
    expect(candidateStageImpliesConnectionRequestSent('QUEUED')).toBe(false);
    expect(candidateStageImpliesConnectionRequestSent(null)).toBe(false);
    expect(candidateStageImpliesConnectionRequestSent('CONNECTION_SENT')).toBe(
      true,
    );
    expect(
      candidateStageImpliesConnectionRequestSent('CONNECTION_ACCEPTED'),
    ).toBe(true);
    expect(
      candidateStageImpliesConnectionRequestSent('CONNECTION_IGNORED'),
    ).toBe(false);
  });
});
