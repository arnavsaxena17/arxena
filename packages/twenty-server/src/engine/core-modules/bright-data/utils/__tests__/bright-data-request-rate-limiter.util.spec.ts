import {
  BrightDataRequestRateLimiter,
  parseRetryAfterMs,
} from 'src/engine/core-modules/bright-data/utils/bright-data-request-rate-limiter.util';

describe('BrightDataRequestRateLimiter', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('should space requests evenly instead of letting a burst through', async () => {
    const limiter = new BrightDataRequestRateLimiter(() => 60);
    const startedAt = Date.now();
    const times: number[] = [];
    const calls = Array.from({ length: 3 }, async () => {
      await limiter.acquire();
      times.push(Date.now() - startedAt);
    });

    await jest.advanceTimersByTimeAsync(3_000);
    await Promise.all(calls);

    expect(times).toEqual([0, 1000, 2000]);
  });

  it('should hold every caller during a pause and then slow down', async () => {
    const limiter = new BrightDataRequestRateLimiter(() => 60);
    const startedAt = Date.now();
    let releasedAt = -1;

    limiter.pause(5_000);

    const call = limiter.acquire().then(() => {
      releasedAt = Date.now() - startedAt;
    });

    await jest.advanceTimersByTimeAsync(4_999);
    expect(releasedAt).toBe(-1);

    await jest.advanceTimersByTimeAsync(10);
    await call;
    expect(releasedAt).toBeGreaterThanOrEqual(5_000);
  });
});

describe('parseRetryAfterMs', () => {
  it('should read seconds and ignore a missing header', () => {
    expect(parseRetryAfterMs('12')).toBe(12_000);
    expect(parseRetryAfterMs(null)).toBeUndefined();
  });
});
