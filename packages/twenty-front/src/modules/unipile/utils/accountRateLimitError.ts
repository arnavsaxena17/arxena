const RATE_LIMIT_REACHED_PATTERN = /rate limit reached/i;
const RETRY_IN_SECONDS_PATTERN = /retry in (\d+)\s*s/i;

export const ACCOUNT_RATE_LIMIT_SNACKBAR_KEY_PREFIX =
  'account-rate-limit';

export const LINKEDIN_RATE_LIMIT_PENDING_REASON = 'linkedin_rate_limit';

export type AccountRateLimitQueuedEvent = {
  waitMs: number;
  scheduledAt?: string;
};

export const isAccountRateLimitErrorMessage = (message: string): boolean =>
  RATE_LIMIT_REACHED_PATTERN.test(message);

const stringifyUnknownError = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Error) {
    return value.message;
  }

  if (value && typeof value === 'object' && 'message' in value) {
    const message = (value as { message?: unknown }).message;

    if (typeof message === 'string') {
      return message;
    }
  }

  return '';
};

export const collectAccountRateLimitErrorMessages = (
  value: unknown,
  collected: Set<string> = new Set(),
): string[] => {
  if (typeof value === 'string') {
    if (isAccountRateLimitErrorMessage(value)) {
      collected.add(value.trim());
    }

    return [...collected];
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectAccountRateLimitErrorMessages(item, collected);
    }

    return [...collected];
  }

  if (value && typeof value === 'object') {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectAccountRateLimitErrorMessages(nested, collected);
    }
  }

  return [...collected];
};

const readQueuedEventFromUnknown = (
  value: unknown,
): AccountRateLimitQueuedEvent | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as {
    status?: unknown;
    pendingReason?: unknown;
    waitMs?: unknown;
    scheduledAt?: unknown;
    result?: unknown;
  };

  const nestedResult =
    record.result && typeof record.result === 'object'
      ? (record.result as {
          pendingReason?: unknown;
          waitMs?: unknown;
          scheduledAt?: unknown;
        })
      : undefined;

  const pendingReason =
    typeof record.pendingReason === 'string'
      ? record.pendingReason
      : typeof nestedResult?.pendingReason === 'string'
        ? nestedResult.pendingReason
        : undefined;

  if (pendingReason !== LINKEDIN_RATE_LIMIT_PENDING_REASON) {
    return null;
  }

  if (record.status !== undefined && record.status !== 'PENDING') {
    return null;
  }

  const waitMs =
    typeof record.waitMs === 'number'
      ? record.waitMs
      : typeof nestedResult?.waitMs === 'number'
        ? nestedResult.waitMs
        : undefined;

  if (!Number.isFinite(waitMs) || waitMs === undefined || waitMs <= 0) {
    return null;
  }

  const scheduledAt =
    typeof record.scheduledAt === 'string'
      ? record.scheduledAt
      : typeof nestedResult?.scheduledAt === 'string'
        ? nestedResult.scheduledAt
        : undefined;

  return { waitMs, scheduledAt };
};

export const collectAccountRateLimitQueuedEvents = (
  value: unknown,
  collected: AccountRateLimitQueuedEvent[] = [],
  seenWaitMs: Set<number> = new Set(),
): AccountRateLimitQueuedEvent[] => {
  const queued = readQueuedEventFromUnknown(value);

  if (queued && !seenWaitMs.has(queued.waitMs)) {
    seenWaitMs.add(queued.waitMs);
    collected.push(queued);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectAccountRateLimitQueuedEvents(item, collected, seenWaitMs);
    }

    return collected;
  }

  if (value && typeof value === 'object') {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectAccountRateLimitQueuedEvents(nested, collected, seenWaitMs);
    }
  }

  return collected;
};

export const isLinkedinRateLimitPendingStep = (value: unknown): boolean =>
  readQueuedEventFromUnknown(value) !== null;

export const formatRetryWaitLabel = (seconds: number): string => {
  if (seconds < 60) {
    return seconds === 1 ? '1 second' : `${seconds} seconds`;
  }

  if (seconds < 3600) {
    const minutes = Math.ceil(seconds / 60);

    return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  }

  if (seconds < 86400) {
    const hours = Math.ceil(seconds / 3600);

    return hours === 1 ? '1 hour' : `${hours} hours`;
  }

  const days = Math.ceil(seconds / 86400);

  return days === 1 ? '1 day' : `${days} days`;
};

export const formatAccountRateLimitSnackBarMessage = (
  rawMessage: string,
): string => {
  const trimmed = rawMessage.trim();
  const retryMatch = trimmed.match(RETRY_IN_SECONDS_PATTERN);
  const retrySeconds = retryMatch ? Number.parseInt(retryMatch[1], 10) : NaN;

  if (!Number.isFinite(retrySeconds) || retrySeconds <= 0) {
    return trimmed;
  }

  return `Rate limit reached for this search. Retry in ${formatRetryWaitLabel(retrySeconds)}.`;
};

export const formatAccountRateLimitQueuedSnackBarMessage = (
  waitMs: number,
): string => {
  const retrySeconds = Math.ceil(waitMs / 1000);

  return `Search queued. Retrying in ${formatRetryWaitLabel(retrySeconds)} (as per the rate limit intervals).`;
};

export const formatAccountRateLimitErrorFromUnknown = (
  value: unknown,
): string | null => {
  const message = stringifyUnknownError(value);

  if (!isAccountRateLimitErrorMessage(message)) {
    return null;
  }

  return formatAccountRateLimitSnackBarMessage(message);
};
