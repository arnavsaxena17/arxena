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

export const getLinkedinRateLimitQueuedEvent = (
  value: unknown,
): AccountRateLimitQueuedEvent | null => readQueuedEventFromUnknown(value);

export const isLinkedinRateLimitPendingStep = (value: unknown): boolean =>
  getLinkedinRateLimitQueuedEvent(value) !== null;

const unitLabel = (count: number, singular: string, plural: string): string =>
  count === 1 ? `1 ${singular}` : `${count} ${plural}`;

export const formatRetryWaitLabel = (seconds: number): string => {
  if (seconds < 60) {
    return unitLabel(seconds, 'second', 'seconds');
  }

  if (seconds < 3600) {
    return unitLabel(Math.ceil(seconds / 60), 'minute', 'minutes');
  }

  if (seconds < 86400) {
    return unitLabel(Math.ceil(seconds / 3600), 'hour', 'hours');
  }

  return unitLabel(Math.ceil(seconds / 86400), 'day', 'days');
};

export const formatRetryWaitLabelFromMs = (waitMs: number): string => {
  const totalSeconds = Math.max(0, Math.round(waitMs / 1000));

  if (totalSeconds < 60) {
    return formatRetryWaitLabel(totalSeconds);
  }

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const parts: string[] = [];

  if (days > 0) {
    parts.push(unitLabel(days, 'day', 'days'));
  }

  if (hours > 0) {
    parts.push(unitLabel(hours, 'hour', 'hours'));
  }

  if (minutes > 0 && days === 0) {
    parts.push(unitLabel(minutes, 'minute', 'minutes'));
  }

  return parts.join(' ') || formatRetryWaitLabel(totalSeconds);
};

export const formatScheduledAtLabel = (scheduledAt: string): string => {
  const date = new Date(scheduledAt);

  if (Number.isNaN(date.getTime())) {
    return scheduledAt;
  }

  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

export type LinkedinRateLimitPendingDisplay = {
  message: string;
  reason: string;
  retryIn: string;
  retryAt?: string;
};

export const formatLinkedinRateLimitPendingDisplay = (
  event: AccountRateLimitQueuedEvent,
  nowMs: number = Date.now(),
): LinkedinRateLimitPendingDisplay => {
  const scheduledAtMs =
    typeof event.scheduledAt === 'string'
      ? new Date(event.scheduledAt).getTime()
      : Number.NaN;
  const remainingMs = Number.isFinite(scheduledAtMs)
    ? Math.max(0, scheduledAtMs - nowMs)
    : event.waitMs;
  const retryIn =
    remainingMs <= 0 ? 'soon' : formatRetryWaitLabelFromMs(remainingMs);
  const retryAt =
    typeof event.scheduledAt === 'string' && Number.isFinite(scheduledAtMs)
      ? formatScheduledAtLabel(event.scheduledAt)
      : undefined;

  return {
    message:
      remainingMs <= 0
        ? 'LinkedIn search is rate limited. Retrying soon.'
        : `LinkedIn search is rate limited. This step will retry automatically in ${retryIn}.`,
    reason: 'LinkedIn rate limit',
    retryIn,
    ...(retryAt ? { retryAt } : {}),
  };
};

export const formatLinkedinRateLimitPendingSubtitle = (
  event: AccountRateLimitQueuedEvent,
  nowMs: number = Date.now(),
): string => {
  const display = formatLinkedinRateLimitPendingDisplay(event, nowMs);

  if (display.retryIn === 'soon') {
    return 'Retrying soon';
  }

  return display.retryAt
    ? `Retrying in ${display.retryIn} · ${display.retryAt}`
    : `Retrying in ${display.retryIn}`;
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
