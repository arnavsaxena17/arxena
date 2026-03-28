import {
  computeStartChatSpreadDelaysMs,
  DEFAULT_START_CHAT_MAX_SPREAD_MINUTES,
} from './start-chat-spread.util';

describe('computeStartChatSpreadDelaysMs', () => {
  it('returns empty for zero candidates', () => {
    expect(computeStartChatSpreadDelaysMs({ candidateCount: 0 })).toEqual([]);
  });

  it('sends a single candidate immediately', () => {
    expect(computeStartChatSpreadDelaysMs({ candidateCount: 1 })).toEqual([0]);
  });

  it('spreads 5 candidates over 5 minutes by default (even spacing)', () => {
    const delays = computeStartChatSpreadDelaysMs({
      candidateCount: 5,
      minutesPerMessage: 1,
      maxSpreadMinutes: DEFAULT_START_CHAT_MAX_SPREAD_MINUTES,
    });
    expect(delays).toHaveLength(5);
    expect(delays[0]).toBe(0);
    expect(delays[4]).toBe(5 * 60 * 1000);
    expect(delays[2]).toBeCloseTo(2.5 * 60 * 1000, -2);
  });

  it('caps total window at maxSpreadMinutes', () => {
    const delays = computeStartChatSpreadDelaysMs({
      candidateCount: 200,
      minutesPerMessage: 1,
      maxSpreadMinutes: 120,
    });
    expect(delays[0]).toBe(0);
    expect(delays[199]).toBe(120 * 60 * 1000);
  });
});
