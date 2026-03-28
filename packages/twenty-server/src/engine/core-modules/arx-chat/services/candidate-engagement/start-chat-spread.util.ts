/** Default: ~one start-chat per minute when batching; cap total window at 120 minutes. */
export const DEFAULT_START_CHAT_SPREAD_MINUTES_PER_MESSAGE = 1;
export const DEFAULT_START_CHAT_MAX_SPREAD_MINUTES = 120;

export type ComputeStartChatSpreadDelaysMsArgs = {
  candidateCount: number;
  /** Minutes between successive starts at ideal rate; spread scales so first is immediate and last is at most `maxSpreadMinutes` after first. */
  minutesPerMessage?: number;
  /** Hard cap on total window (first → last) in minutes. */
  maxSpreadMinutes?: number;
};

/**
 * Evenly spaces start-chat jobs over [0, spanMinutes] where
 * spanMinutes = min(n * minutesPerMessage, maxSpreadMinutes) for n > 1.
 * Single candidate: immediate (0 ms).
 */
export function computeStartChatSpreadDelaysMs({
  candidateCount,
  minutesPerMessage = DEFAULT_START_CHAT_SPREAD_MINUTES_PER_MESSAGE,
  maxSpreadMinutes = DEFAULT_START_CHAT_MAX_SPREAD_MINUTES,
}: ComputeStartChatSpreadDelaysMsArgs): number[] {
  const n = candidateCount;
  if (n <= 0) {
    return [];
  }
  if (n === 1) {
    return [0];
  }

  const perMessage = Number.isFinite(minutesPerMessage) && minutesPerMessage > 0
    ? minutesPerMessage
    : DEFAULT_START_CHAT_SPREAD_MINUTES_PER_MESSAGE;
  const maxSpread = Number.isFinite(maxSpreadMinutes) && maxSpreadMinutes > 0
    ? maxSpreadMinutes
    : DEFAULT_START_CHAT_MAX_SPREAD_MINUTES;

  const rawSpanMinutes = n * perMessage;
  const spanMinutes = Math.min(rawSpanMinutes, maxSpread);
  const spanMs = spanMinutes * 60 * 1000;
  const lastIndex = n - 1;

  return Array.from({ length: n }, (_, i) =>
    Math.round((i / lastIndex) * spanMs),
  );
}
