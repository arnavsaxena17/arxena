import { classifyInboundReplyFallback } from 'src/engine/core-modules/outreach-command/utils/outreach-inbound-reply-classifier.util';

describe('outreach-inbound-reply-classifier.util', () => {
  it('maps opt-out language to STOPPED and NOT_INTERESTED', () => {
    const result = classifyInboundReplyFallback('Please unsubscribe me');

    expect(result.stage).toBe('STOPPED');
    expect(result.conversationStage).toBe('NOT_INTERESTED');
  });

  it('maps later / busy language to REPLIED cadence and SNOOZED conversation', () => {
    const result = classifyInboundReplyFallback(
      'Not a good time, ping me later',
    );

    expect(result.stage).toBe('REPLIED');
    expect(result.conversationStage).toBe('SNOOZED');
  });

  it('maps interest without a time to INTENT', () => {
    const result = classifyInboundReplyFallback(
      'Sounds interesting, tell me more',
    );

    expect(result.stage).toBe('REPLIED');
    expect(result.conversationStage).toBe('INTENT');
  });

  it('maps explicit booking to MEETING_BOOKED conversation', () => {
    const result = classifyInboundReplyFallback(
      'Tuesday works — send the invite',
    );

    expect(result.stage).toBe('REPLIED');
    expect(result.conversationStage).toBe('MEETING_BOOKED');
  });

  it('maps a numbered time offer to FOLLOW_UP_MEETING', () => {
    const result = classifyInboundReplyFallback(
      'How about Thursday 3pm or Friday 10am?',
    );

    expect(result.intent).toBe('times_proposed');
    expect(result.stage).toBe('REPLIED');
    expect(result.conversationStage).toBe('FOLLOW_UP_MEETING');
  });

  it('maps sales closer sample threads to REPLIED cadence', () => {
    expect(
      classifyInboundReplyFallback(
        'Thanks for reaching out. Contact no is 9376828884 at 2:30 pm tomorrow',
      ).conversationStage,
    ).toBe('FOLLOW_UP_MEETING');
    expect(
      classifyInboundReplyFallback('Sure lets keep on Sat // Lets do Sat 11 am')
        .conversationStage,
    ).toBe('FOLLOW_UP_MEETING');
    expect(
      classifyInboundReplyFallback(
        'This sounds interesting. Yes sure Friday next week is relatively free OK',
      ).conversationStage,
    ).toBe('INTENT');
  });

  it('defaults questions to ACKNOWLEDGEMENT', () => {
    const result = classifyInboundReplyFallback('Who else uses this?');

    expect(result.stage).toBe('REPLIED');
    expect(result.conversationStage).toBe('ACKNOWLEDGEMENT');
  });
});
