const RATE_LIMIT_REACHED_PATTERN = /rate limit reached/i;
const RETRY_IN_SECONDS_PATTERN = /retry in (\d+)\s*s/i;

export const ACCOUNT_RATE_LIMIT_SNACKBAR_KEY_PREFIX =
  'account-rate-limit';

export const LINKEDIN_RATE_LIMIT_PENDING_REASON = 'linkedin_rate_limit';

export const OUTREACH_SEND_WINDOW_PENDING_REASON = 'outreach_send_window';

export const OUTREACH_UNIPILE_PACING_PENDING_REASON = 'outreach_unipile_pacing';

export const OUTREACH_PROJECT_PAUSED_PENDING_REASON = 'outreach_project_paused';

const LEGACY_GTM_SEND_WINDOW_PENDING_REASON = 'gtm_send_window';

const WORKFLOW_CAPACITY_PENDING_REASONS = new Set([
  LINKEDIN_RATE_LIMIT_PENDING_REASON,
  OUTREACH_SEND_WINDOW_PENDING_REASON,
  OUTREACH_UNIPILE_PACING_PENDING_REASON,
  OUTREACH_PROJECT_PAUSED_PENDING_REASON,
]);

export const normalizeWorkflowPendingReason = (
  pendingReason?: string,
): string | undefined => {
  if (!pendingReason?.trim()) {
    return undefined;
  }

  if (pendingReason === LEGACY_GTM_SEND_WINDOW_PENDING_REASON) {
    return OUTREACH_SEND_WINDOW_PENDING_REASON;
  }

  return pendingReason;
};

export type AccountRateLimitQueuedEvent = {
  waitMs: number;
  scheduledAt?: string;
  method?: string;
};

export type WorkflowPendingQueuedEvent = AccountRateLimitQueuedEvent & {
  pendingReason: string;
};

type PendingStepFields = {
  status?: unknown;
  pendingReason?: string;
  waitMs?: number;
  scheduledAt?: string;
  method?: string;
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

const readPendingStepFieldsFromUnknown = (
  value: unknown,
): PendingStepFields | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as {
    status?: unknown;
    pendingReason?: unknown;
    waitMs?: unknown;
    scheduledAt?: unknown;
    method?: unknown;
    result?: unknown;
  };

  const nestedResult =
    record.result && typeof record.result === 'object'
      ? (record.result as {
          pendingReason?: unknown;
          waitMs?: unknown;
          scheduledAt?: unknown;
          method?: unknown;
        })
      : undefined;

  const pendingReason =
    typeof record.pendingReason === 'string'
      ? record.pendingReason
      : typeof nestedResult?.pendingReason === 'string'
        ? nestedResult.pendingReason
        : undefined;

  const waitMs =
    typeof record.waitMs === 'number'
      ? record.waitMs
      : typeof nestedResult?.waitMs === 'number'
        ? nestedResult.waitMs
        : undefined;

  const scheduledAt =
    typeof record.scheduledAt === 'string'
      ? record.scheduledAt
      : typeof nestedResult?.scheduledAt === 'string'
        ? nestedResult.scheduledAt
        : undefined;

  const method =
    typeof record.method === 'string'
      ? record.method
      : typeof nestedResult?.method === 'string'
        ? nestedResult.method
        : undefined;

  return {
    status: record.status,
    pendingReason,
    waitMs,
    scheduledAt,
    method,
  };
};

const hasSchedulableWait = ({
  waitMs,
  scheduledAt,
}: PendingStepFields): boolean =>
  (typeof scheduledAt === 'string' && scheduledAt.length > 0) ||
  (typeof waitMs === 'number' && Number.isFinite(waitMs) && waitMs > 0);

const isWorkflowCapacityPendingReason = (
  pendingReason?: string,
): pendingReason is string => {
  const normalizedPendingReason =
    normalizeWorkflowPendingReason(pendingReason);

  return (
    normalizedPendingReason !== undefined &&
    WORKFLOW_CAPACITY_PENDING_REASONS.has(normalizedPendingReason)
  );
};

export const getWorkflowPendingQueuedEvent = (
  value: unknown,
): WorkflowPendingQueuedEvent | null => {
  const fields = readPendingStepFieldsFromUnknown(value);

  if (!fields) {
    return null;
  }

  const pendingReason = normalizeWorkflowPendingReason(fields.pendingReason);

  if (!isWorkflowCapacityPendingReason(pendingReason)) {
    return null;
  }

  if (fields.status !== undefined && fields.status !== 'PENDING') {
    return null;
  }

  if (
    pendingReason !== OUTREACH_PROJECT_PAUSED_PENDING_REASON &&
    !hasSchedulableWait(fields)
  ) {
    return null;
  }

  const waitMs =
    typeof fields.waitMs === 'number' && Number.isFinite(fields.waitMs)
      ? fields.waitMs
      : 0;

  return {
    pendingReason,
    waitMs,
    ...(fields.scheduledAt ? { scheduledAt: fields.scheduledAt } : {}),
    ...(fields.method ? { method: fields.method } : {}),
  };
};

const readQueuedEventFromUnknown = (
  value: unknown,
): AccountRateLimitQueuedEvent | null => {
  const queuedEvent = getWorkflowPendingQueuedEvent(value);

  if (queuedEvent?.pendingReason !== LINKEDIN_RATE_LIMIT_PENDING_REASON) {
    return null;
  }

  return {
    waitMs: queuedEvent.waitMs,
    scheduledAt: queuedEvent.scheduledAt,
    ...(queuedEvent.method ? { method: queuedEvent.method } : {}),
  };
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

const LINKEDIN_RATE_LIMIT_ACTION_LABELS: Record<string, string> = {
  search: 'LinkedIn search',
  connection_request: 'LinkedIn connection request',
  message: 'LinkedIn message',
  inmail: 'LinkedIn InMail',
  comment: 'LinkedIn comment',
  profile: 'LinkedIn profile lookup',
  company_profile: 'LinkedIn company profile lookup',
  endpoint: 'LinkedIn request',
};

export const formatLinkedinRateLimitActionLabel = (
  method?: string,
): string => LINKEDIN_RATE_LIMIT_ACTION_LABELS[method ?? ''] ?? 'LinkedIn search';

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
  const actionLabel = formatLinkedinRateLimitActionLabel(event.method);

  return {
    message:
      remainingMs <= 0
        ? `${actionLabel} is rate limited. Retrying soon.`
        : `${actionLabel} is rate limited. This step will retry automatically in ${retryIn}.`,
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

const WORKFLOW_PENDING_REASON_LABELS: Record<string, string> = {
  [LINKEDIN_RATE_LIMIT_PENDING_REASON]: 'LinkedIn rate limit',
  [OUTREACH_SEND_WINDOW_PENDING_REASON]: 'Outside send window',
  [OUTREACH_UNIPILE_PACING_PENDING_REASON]: 'Outreach pacing',
  [OUTREACH_PROJECT_PAUSED_PENDING_REASON]: 'Outreach paused',
};

const formatPendingActionLabel = (
  event: WorkflowPendingQueuedEvent,
): string => {
  if (event.pendingReason === LINKEDIN_RATE_LIMIT_PENDING_REASON) {
    return formatLinkedinRateLimitActionLabel(event.method);
  }

  return formatLinkedinRateLimitActionLabel(event.method) !== 'LinkedIn search'
    ? formatLinkedinRateLimitActionLabel(event.method)
    : 'This step';
};

const getWorkflowPendingRemainingMs = (
  event: WorkflowPendingQueuedEvent,
  nowMs: number,
): number => {
  const scheduledAtMs =
    typeof event.scheduledAt === 'string'
      ? new Date(event.scheduledAt).getTime()
      : Number.NaN;

  if (Number.isFinite(scheduledAtMs)) {
    return Math.max(0, scheduledAtMs - nowMs);
  }

  return event.waitMs;
};

export const formatWorkflowPendingDisplay = (
  event: WorkflowPendingQueuedEvent,
  nowMs: number = Date.now(),
): LinkedinRateLimitPendingDisplay => {
  if (event.pendingReason === LINKEDIN_RATE_LIMIT_PENDING_REASON) {
    return formatLinkedinRateLimitPendingDisplay(event, nowMs);
  }

  if (event.pendingReason === OUTREACH_PROJECT_PAUSED_PENDING_REASON) {
    return {
      message:
        'Outreach is paused for this project. This step will resume when you unpause.',
      reason: WORKFLOW_PENDING_REASON_LABELS[event.pendingReason],
      retryIn: 'when resumed',
    };
  }

  const remainingMs = getWorkflowPendingRemainingMs(event, nowMs);
  const retryIn =
    remainingMs <= 0 ? 'soon' : formatRetryWaitLabelFromMs(remainingMs);
  const scheduledAtMs =
    typeof event.scheduledAt === 'string'
      ? new Date(event.scheduledAt).getTime()
      : Number.NaN;
  const retryAt =
    typeof event.scheduledAt === 'string' && Number.isFinite(scheduledAtMs)
      ? formatScheduledAtLabel(event.scheduledAt)
      : undefined;
  const actionLabel = formatPendingActionLabel(event);
  const reason =
    WORKFLOW_PENDING_REASON_LABELS[event.pendingReason] ?? 'Waiting';

  return {
    message:
      remainingMs <= 0
        ? `${actionLabel} will run soon.`
        : `${actionLabel} will run automatically in ${retryIn}.`,
    reason,
    retryIn,
    ...(retryAt ? { retryAt } : {}),
  };
};

export const formatWorkflowPendingSubtitle = (
  event: WorkflowPendingQueuedEvent,
  nowMs: number = Date.now(),
): string => {
  if (event.pendingReason === OUTREACH_PROJECT_PAUSED_PENDING_REASON) {
    return 'Waiting until outreach resumes';
  }

  if (event.pendingReason === LINKEDIN_RATE_LIMIT_PENDING_REASON) {
    return formatLinkedinRateLimitPendingSubtitle(event, nowMs);
  }

  const display = formatWorkflowPendingDisplay(event, nowMs);

  if (display.retryIn === 'soon') {
    return 'Sending soon';
  }

  return display.retryAt
    ? `Sending in ${display.retryIn} · ${display.retryAt}`
    : `Sending in ${display.retryIn}`;
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
