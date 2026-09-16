import { summarizeFetchedLinkedinMessages } from 'src/engine/core-modules/outreach-command/utils/summarize-fetched-linkedin-messages.util';

describe('summarizeFetchedLinkedinMessages', () => {
  it('returns false when there are no messages', () => {
    expect(summarizeFetchedLinkedinMessages([])).toEqual({
      hasInboundReply: false,
      inboundCount: 0,
    });
  });

  it('returns false when only our outbound exists', () => {
    expect(
      summarizeFetchedLinkedinMessages([
        { isSender: true },
        { isSender: true },
      ]),
    ).toEqual({
      hasInboundReply: false,
      inboundCount: 0,
    });
  });

  it('returns true when any inbound turn exists', () => {
    expect(
      summarizeFetchedLinkedinMessages([
        { isSender: true },
        { isSender: false },
        { isSender: true },
      ]),
    ).toEqual({
      hasInboundReply: true,
      inboundCount: 1,
    });
  });
});
