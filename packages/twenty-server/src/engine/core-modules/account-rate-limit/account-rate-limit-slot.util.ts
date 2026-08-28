import { MS_PER_FIVE_MINUTES } from 'twenty-shared/arx';

export const ACCOUNT_RATE_LIMIT_PACE_MAX_WINDOW_MS = MS_PER_FIVE_MINUTES;

export type AccountRateLimitSlotWindow = {
  windowMs: number;
  limit: number;
  pace: boolean;
  scores: number[];
};

export const shouldPaceAccountRateLimitWindow = (windowMs: number): boolean =>
  windowMs <= ACCOUNT_RATE_LIMIT_PACE_MAX_WINDOW_MS;

export const pacingIntervalMs = (windowMs: number, limit: number): number =>
  Math.max(1, Math.floor(windowMs / Math.max(1, limit)));

const scoresInWindow = (
  scores: number[],
  scheduled: number,
  windowMs: number,
): number[] => scores.filter((score) => score > scheduled - windowMs);

export const nextSlotForWindowMs = (
  window: AccountRateLimitSlotWindow,
  now: number,
): number => {
  const limit = Math.max(1, window.limit);
  const scores = scoresInWindow(window.scores, now, window.windowMs);

  if (window.pace) {
    const last = scores[scores.length - 1];
    if (last == null) {
      return now;
    }

    return Math.max(now, last + pacingIntervalMs(window.windowMs, limit));
  }

  const activeScores = scores.filter((score) => score <= now);

  if (activeScores.length < limit) {
    return now;
  }

  return Math.max(
    now,
    activeScores[activeScores.length - limit] + window.windowMs,
  );
};

export const computeReservedSlotMs = (
  windows: AccountRateLimitSlotWindow[],
  now: number,
): number =>
  windows.reduce(
    (scheduled, window) => Math.max(scheduled, nextSlotForWindowMs(window, now)),
    now,
  );

export const remainingWaitMsForExistingScore = (
  score: number,
  now: number,
): number => Math.max(0, score - now);

/**
 * Atomically reserve the next unique slot across overlapping windows.
 * Always ZADDs at the reserved time so later waiters space out instead of
 * sharing one retry instant. Re-entry with the same member returns the
 * remaining wait without booking another slot.
 */
export const RESERVE_MULTI_WINDOW_SLOT_LUA = `
      local now = tonumber(ARGV[1])
      local member = ARGV[2]
      local n = tonumber(ARGV[3])
      local existing = redis.call('ZSCORE', KEYS[1], member .. ':1')
      if existing then
        local wait = tonumber(existing) - now
        if wait < 0 then
          wait = 0
        end
        return wait
      end
      local scheduled = now
      for i = 1, n do
        local key = KEYS[i]
        local window = tonumber(ARGV[3 + (i - 1) * 3 + 1])
        local limit = tonumber(ARGV[3 + (i - 1) * 3 + 2])
        local pace = tonumber(ARGV[3 + (i - 1) * 3 + 3])
        if limit < 1 then
          limit = 1
        end
        redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
        local packed = redis.call('ZRANGE', key, 0, -1, 'WITHSCORES')
        local nextSlot = now
        if pace == 1 then
          local interval = math.floor(window / limit)
          if interval < 1 then
            interval = 1
          end
          if #packed >= 2 then
            nextSlot = tonumber(packed[#packed]) + interval
            if nextSlot < now then
              nextSlot = now
            end
          end
        else
          local activeScores = {}
          for j = 1, #packed, 2 do
            local score = tonumber(packed[j + 1])
            if score <= now then
              activeScores[#activeScores + 1] = score
            end
          end
          table.sort(activeScores)
          local count = #activeScores
          if count >= limit then
            nextSlot = activeScores[count - limit + 1] + window
            if nextSlot < now then
              nextSlot = now
            end
          end
        end
        if nextSlot > scheduled then
          scheduled = nextSlot
        end
      end
      for i = 1, n do
        local key = KEYS[i]
        local window = tonumber(ARGV[3 + (i - 1) * 3 + 1])
        redis.call('ZADD', key, scheduled, member .. ':' .. i)
        local ttlMs = window + math.max(0, scheduled - now)
        local ttlSec = math.ceil(ttlMs / 1000) * 2
        if ttlSec < 1 then
          ttlSec = 1
        end
        redis.call('EXPIRE', key, ttlSec)
      end
      return scheduled - now
    `;
