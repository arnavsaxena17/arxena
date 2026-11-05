import {
  hasOutreachReply,
  OUTREACH_ENGAGED_STAGES,
} from 'src/engine/core-modules/outreach-command/utils/outreach-replied.util';

describe('hasOutreachReply', () => {
  it('should treat every engaged stage as replied', () => {
    for (const stage of OUTREACH_ENGAGED_STAGES) {
      expect(hasOutreachReply({ outreachSequenceStage: stage })).toBe(true);
    }
  });

  it('should treat a recorded inbound message as replied even without the stage', () => {
    expect(
      hasOutreachReply({
        outreachSequenceStage: 'WAITING_REPLY',
        outreachAnalytics: { v: 1, lastInboundAt: '2026-11-01T10:00:00.000Z' },
      }),
    ).toBe(true);
  });

  it('should allow cold and silently-accepted prospects', () => {
    for (const stage of [
      'QUEUED',
      'CONNECTION_SENT',
      'CONNECTION_IGNORED',
      'CONNECTION_ACCEPTED',
      'EMAIL_SENT',
      'WAITING_REPLY',
      'FAILED_NO_REPLY',
    ]) {
      expect(
        hasOutreachReply({
          outreachSequenceStage: stage,
          outreachAnalytics: {
            v: 1,
            lastOutboundAt: '2026-11-01T10:00:00.000Z',
          },
        }),
      ).toBe(false);
    }
  });

  it('should tolerate a missing candidate', () => {
    expect(hasOutreachReply(undefined)).toBe(false);
    expect(hasOutreachReply(null)).toBe(false);
  });
});
