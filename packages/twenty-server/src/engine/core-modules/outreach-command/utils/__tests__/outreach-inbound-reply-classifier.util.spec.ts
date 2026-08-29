import { classifyInboundReplyFallback } from 'src/engine/core-modules/outreach-command/utils/outreach-inbound-reply-classifier.util';

describe('outreach-inbound-reply-classifier.util', () => {
  it('maps opt-out language to STOPPED', () => {
    expect(classifyInboundReplyFallback('Please unsubscribe me').stage).toBe(
      'STOPPED',
    );
  });

  it('maps later / busy language to DEFERRED', () => {
    expect(
      classifyInboundReplyFallback('Not a good time, ping me later').stage,
    ).toBe('DEFERRED');
  });

  it('maps interest without a time to NEGOTIATING', () => {
    expect(
      classifyInboundReplyFallback('Sounds interesting, tell me more').stage,
    ).toBe('NEGOTIATING');
  });

  it('maps explicit booking to MEETING_BOOKED', () => {
    expect(
      classifyInboundReplyFallback('Tuesday works — send the invite').stage,
    ).toBe('MEETING_BOOKED');
  });

  it('maps a numbered time offer to REPLIED times_proposed', () => {
    const result = classifyInboundReplyFallback(
      'How about Thursday 3pm or Friday 10am?',
    );

    expect(result.intent).toBe('times_proposed');
    expect(result.stage).toBe('REPLIED');
  });

  it('defaults questions to REPLIED', () => {
    expect(classifyInboundReplyFallback('Who else uses this?').stage).toBe(
      'REPLIED',
    );
  });
});
