import { summarizeFetchedLinkedinMessages } from 'src/engine/core-modules/outreach-command/utils/summarize-fetched-linkedin-messages.util';

const EMPTY_SUMMARY = {
  hasInboundReply: false,
  inboundCount: 0,
  hasManualOutbound: false,
  manualOutboundCount: 0,
  memberSentLast: false,
};

describe('summarizeFetchedLinkedinMessages', () => {
  it('returns an all-false summary when there are no messages', () => {
    expect(summarizeFetchedLinkedinMessages([])).toEqual(EMPTY_SUMMARY);
  });

  it('returns false when only our outbound exists', () => {
    expect(
      summarizeFetchedLinkedinMessages([
        { isSender: true, origin: 'agent' },
        { isSender: true, origin: 'agent' },
      ]),
    ).toEqual(EMPTY_SUMMARY);
  });

  it('treats an untagged outbound as non-manual during the origin backfill', () => {
    expect(summarizeFetchedLinkedinMessages([{ isSender: true }])).toEqual(
      EMPTY_SUMMARY,
    );
  });

  it('returns true when any inbound turn exists', () => {
    expect(
      summarizeFetchedLinkedinMessages([
        { isSender: true, origin: 'agent' },
        { isSender: false, origin: 'prospect' },
        { isSender: true, origin: 'agent' },
      ]),
    ).toEqual({
      ...EMPTY_SUMMARY,
      hasInboundReply: true,
      inboundCount: 1,
    });
  });

  it('flags a member reply the sequencer never sent', () => {
    expect(
      summarizeFetchedLinkedinMessages([
        { isSender: true, origin: 'agent' },
        { isSender: true, origin: 'member' },
      ]),
    ).toEqual({
      ...EMPTY_SUMMARY,
      hasManualOutbound: true,
      manualOutboundCount: 1,
      memberSentLast: true,
    });
  });

  it('clears memberSentLast once the prospect answers the member', () => {
    expect(
      summarizeFetchedLinkedinMessages([
        { isSender: true, origin: 'agent' },
        { isSender: true, origin: 'member' },
        { isSender: false, origin: 'prospect' },
      ]),
    ).toEqual({
      ...EMPTY_SUMMARY,
      hasInboundReply: true,
      inboundCount: 1,
      hasManualOutbound: true,
      manualOutboundCount: 1,
      memberSentLast: false,
    });
  });

  it('does not read an agent system note as an inbound reply', () => {
    expect(
      summarizeFetchedLinkedinMessages([
        { isSender: true, origin: 'agent' },
        { isSender: false, origin: 'system' },
      ]),
    ).toEqual(EMPTY_SUMMARY);
  });
});
