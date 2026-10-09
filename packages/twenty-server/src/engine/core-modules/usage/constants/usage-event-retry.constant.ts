/* @license Enterprise */

export const USAGE_EVENT_RETRY_MAX_ATTEMPTS = 5;

// Retries back off exponentially (30s, 60s, 2m, 4m, 8m) because the usual
// cause is a short ClickHouse outage and BullMQ's own retries are immediate.
export const USAGE_EVENT_RETRY_BASE_DELAY_MS = 30_000;
