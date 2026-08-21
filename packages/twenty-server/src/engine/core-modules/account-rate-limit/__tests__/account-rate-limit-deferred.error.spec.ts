import { isAccountRateLimitDeferredError } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';
import { AccountRateLimitDeferredError } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';

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
});
