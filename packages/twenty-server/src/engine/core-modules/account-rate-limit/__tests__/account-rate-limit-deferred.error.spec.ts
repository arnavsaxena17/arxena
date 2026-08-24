import {
  AccountRateLimitDeferredError,
  isAccountRateLimitDeferredError,
  parseMethodFromAccountRateLimitMessage,
  parseWaitMsFromAccountRateLimitMessage,
} from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';

describe('workflow rate-limit delay', () => {
  it('identifies deferred errors so the workflow can resume later', () => {
    const error = new AccountRateLimitDeferredError({
      waitMs: 30_000,
      accountId: 'acc-1',
      method: 'connection_request',
    });

    expect(isAccountRateLimitDeferredError(error)).toBe(true);
    expect(error.waitMs).toBe(30_000);
  });

  it('parses retry wait from limiter messages', () => {
    expect(
      parseWaitMsFromAccountRateLimitMessage(
        'Rate limit reached for this search on account ABC. Retry in 81711s.',
      ),
    ).toBe(81_711_000);
  });

  it('parses the rate-limited method from limiter messages', () => {
    expect(
      parseMethodFromAccountRateLimitMessage(
        'Rate limit reached for this connection_request on account ABC. Retry in 300s.',
      ),
    ).toBe('connection_request');
  });
});
