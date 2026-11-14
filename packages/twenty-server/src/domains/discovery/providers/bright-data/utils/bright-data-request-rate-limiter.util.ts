const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

// After a 429 the rate stays halved for this long, then recovers
const SLOWED_WINDOW_MS = 60_000;
const DEFAULT_PAUSE_MS = 10_000;

// Paces requests to a per-minute budget that refills continuously (Bright Data
// counts Business Search per account, category and mode). Callers wait for an
// evenly spaced slot instead of bursting. A 429 pauses everyone sharing the
// limiter, honoring the server's Retry-After, and halves the rate for a while:
// workers must not retry the same request on their own.
export class BrightDataRequestRateLimiter {
  private nextSlotAt = 0;
  private pausedUntil = 0;
  private slowedUntil = 0;

  constructor(private readonly requestsPerMinute: () => number) {}

  async acquire(): Promise<void> {
    for (;;) {
      const now = Date.now();

      if (now < this.pausedUntil) {
        await sleep(this.pausedUntil - now);
        continue;
      }

      const slot = Math.max(now, this.nextSlotAt);

      this.nextSlotAt = slot + this.spacingMs(now);

      // A wait under a millisecond is not worth a timer
      if (slot - now >= 1) {
        await sleep(slot - now);
      }

      // A pause set while this caller waited for its slot still applies
      if (Date.now() < this.pausedUntil) {
        continue;
      }

      return;
    }
  }

  pause(milliseconds?: number): void {
    const now = Date.now();
    const pauseMs =
      typeof milliseconds === 'number' && milliseconds > 0
        ? milliseconds
        : DEFAULT_PAUSE_MS;

    this.pausedUntil = Math.max(this.pausedUntil, now + pauseMs);
    this.slowedUntil = Math.max(this.slowedUntil, now + SLOWED_WINDOW_MS);
    this.nextSlotAt = Math.max(this.nextSlotAt, this.pausedUntil);
  }

  private spacingMs(now: number): number {
    const perMinute = Math.max(1, this.requestsPerMinute());
    const effective = now < this.slowedUntil ? perMinute / 2 : perMinute;

    return 60_000 / effective;
  }
}

// "Retry-After: 12" (seconds) or an HTTP date
export const parseRetryAfterMs = (
  header: string | null | undefined,
): number | undefined => {
  if (typeof header !== 'string' || header.trim() === '') {
    return undefined;
  }

  const seconds = Number(header);

  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1000);
  }

  const date = Date.parse(header);

  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
};
