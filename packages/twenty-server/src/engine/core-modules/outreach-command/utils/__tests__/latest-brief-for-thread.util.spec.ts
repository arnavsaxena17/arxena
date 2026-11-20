import {
  latestBriefForThread,
  latestBriefFromOtherThread,
} from 'src/engine/core-modules/outreach-command/utils/sourcing-ledger.util';

const brief = (who: string, threadId?: string) => ({
  kind: 'brief' as const,
  at: '2026-11-19T00:00:00.000Z',
  requestType: 'named_role' as const,
  target: null,
  who,
  criteria: [],
  assumptions: [],
  sources: ['bright-data'],
  ...(threadId !== undefined && { threadId }),
});

const events = [
  brief('legacy brief with no thread'),
  brief('old request', 'thread-old'),
  { kind: 'search' },
  brief('this request', 'thread-new'),
  brief('another old request', 'thread-old'),
];

describe('latestBriefForThread', () => {
  it("should read only this thread's latest brief", () => {
    expect(latestBriefForThread(events, 'thread-new')?.who).toBe(
      'this request',
    );
  });

  it('should give a new thread no brief, so the request starts fresh', () => {
    expect(latestBriefForThread(events, 'thread-brand-new')).toBeUndefined();
  });

  it('should fall back to the latest brief when there is no thread', () => {
    expect(latestBriefForThread(events, undefined)?.who).toBe(
      'another old request',
    );
  });
});

describe('latestBriefFromOtherThread', () => {
  it("should name another thread's latest brief", () => {
    expect(latestBriefFromOtherThread(events, 'thread-brand-new')?.who).toBe(
      'another old request',
    );
  });

  it('should name nothing when there is no thread', () => {
    expect(latestBriefFromOtherThread(events, undefined)).toBeUndefined();
  });
});
