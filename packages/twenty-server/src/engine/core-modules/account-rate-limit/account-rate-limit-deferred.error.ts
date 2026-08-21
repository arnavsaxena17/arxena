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
