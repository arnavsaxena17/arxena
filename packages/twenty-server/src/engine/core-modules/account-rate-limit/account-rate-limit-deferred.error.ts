export const LINKEDIN_RATE_LIMIT_PENDING_REASON = 'linkedin_rate_limit';

const RETRY_IN_SECONDS_PATTERN = /retry in (\d+)\s*s/i;

export const parseWaitMsFromAccountRateLimitMessage = (
  message: string,
): number | undefined => {
  const match = message.match(RETRY_IN_SECONDS_PATTERN);
  if (!match) {
    return undefined;
  }

  const seconds = Number.parseInt(match[1], 10);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return undefined;
  }

  return seconds * 1000;
};

export class AccountRateLimitDeferredError extends Error {
  readonly waitMs: number;
  readonly accountId: string;
  readonly method: string;

  constructor({
    waitMs,
    accountId,
    method,
    message,
  }: {
    waitMs: number;
    accountId: string;
    method: string;
    message?: string;
  }) {
    super(
      message ??
        `Rate limit reached for this ${method} on account ${accountId}. Retry in ${Math.ceil(waitMs / 1000)}s.`,
    );
    this.name = 'AccountRateLimitDeferredError';
    this.waitMs = waitMs;
    this.accountId = accountId;
    this.method = method;
  }
}

export const isAccountRateLimitDeferredError = (
  error: unknown,
): error is AccountRateLimitDeferredError =>
  error instanceof AccountRateLimitDeferredError;
