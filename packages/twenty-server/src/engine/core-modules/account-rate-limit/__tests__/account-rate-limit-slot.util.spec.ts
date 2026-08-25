import { MS_PER_DAY, MS_PER_FIVE_MINUTES, MS_PER_MINUTE } from 'twenty-shared/arx';

import {
  computeReservedSlotMs,
  remainingWaitMsForExistingScore,
  shouldPaceAccountRateLimitWindow,
  type AccountRateLimitSlotWindow,
} from 'src/engine/core-modules/account-rate-limit/account-rate-limit-slot.util';

const reserveSequentialWaits = (
  templates: Array<Omit<AccountRateLimitSlotWindow, 'scores'>>,
  count: number,
  now: number,
): number[] => {
  const stores = templates.map(() => [] as number[]);
  const waits: number[] = [];

  for (let index = 0; index < count; index += 1) {
    const windows: AccountRateLimitSlotWindow[] = templates.map(
      (template, windowIndex) => ({
        ...template,
        scores: stores[windowIndex],
      }),
    );
    const scheduled = computeReservedSlotMs(windows, now);
    waits.push(scheduled - now);
    stores.forEach((store) => store.push(scheduled));
  }

  return waits;
};

describe('account rate limit slot reservation', () => {
  it('paces windows of 5 minutes or less and treats longer windows as caps', () => {
    expect(shouldPaceAccountRateLimitWindow(MS_PER_MINUTE)).toBe(true);
    expect(shouldPaceAccountRateLimitWindow(MS_PER_FIVE_MINUTES)).toBe(true);
    expect(shouldPaceAccountRateLimitWindow(3_600_000)).toBe(false);
    expect(shouldPaceAccountRateLimitWindow(MS_PER_DAY)).toBe(false);
  });

  it('spaces a flood of connection requests onto unique 5-minute slots', () => {
    expect(
      reserveSequentialWaits(
        [
          {
            windowMs: MS_PER_FIVE_MINUTES,
            limit: 1,
            pace: true,
          },
        ],
        4,
        0,
      ),
    ).toEqual([0, 300_000, 600_000, 900_000]);
  });

  it('spaces 5-per-minute endpoint lookups instead of bursting all 5 immediately', () => {
    expect(
      reserveSequentialWaits(
        [
          {
            windowMs: MS_PER_MINUTE,
            limit: 5,
            pace: true,
          },
        ],
        6,
        0,
      ),
    ).toEqual([0, 12_000, 24_000, 36_000, 48_000, 60_000]);
  });

  it('keeps day/week as caps so waiters get unique expiry slots without uniform day pacing', () => {
    expect(
      reserveSequentialWaits(
        [
          {
            windowMs: MS_PER_DAY,
            limit: 2,
            pace: false,
          },
        ],
        4,
        1_000,
      ),
    ).toEqual([0, 0, MS_PER_DAY, MS_PER_DAY]);
  });

  it('takes the max of paced short windows and capped long windows', () => {
    expect(
      reserveSequentialWaits(
        [
          {
            windowMs: MS_PER_FIVE_MINUTES,
            limit: 1,
            pace: true,
          },
          {
            windowMs: MS_PER_DAY,
            limit: 2,
            pace: false,
          },
        ],
        4,
        0,
      ),
    ).toEqual([0, 300_000, MS_PER_DAY, MS_PER_DAY + 300_000]);
  });

  it('returns remaining wait for an existing reservation without booking another slot', () => {
    expect(remainingWaitMsForExistingScore(10_000, 4_000)).toBe(6_000);
    expect(remainingWaitMsForExistingScore(4_000, 10_000)).toBe(0);
  });
});
