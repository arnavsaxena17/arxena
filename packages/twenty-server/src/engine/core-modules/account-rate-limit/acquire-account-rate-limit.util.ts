import { runWithAccountRateLimitAcquireScope } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-reservation.context';
import { getRegisteredAccountRateLimiter } from 'src/engine/core-modules/account-rate-limit/account-rate-limiter.registry';
import {
  type AccountRateLimitMethod,
  type AccountRateLimitProvider,
} from 'src/engine/core-modules/account-rate-limit/account-rate-limiter.service';

export type AcquireAccountRateLimitParams = {
  provider: AccountRateLimitProvider;
  accountId: string;
  method: AccountRateLimitMethod;
  startChatPerMinuteOverride?: number;
};

export const acquireAccountRateLimitOrDefer = async (
  params: AcquireAccountRateLimitParams,
): Promise<void> => {
  const limiter = getRegisteredAccountRateLimiter();
  if (!limiter) {
    return;
  }

  await limiter.acquireOrDefer(params);
};

export const withAcquiredAccountRateLimit = async <T>(
  params: AcquireAccountRateLimitParams,
  fn: () => Promise<T>,
): Promise<T> => {
  const limiter = getRegisteredAccountRateLimiter();
  if (!limiter) {
    return fn();
  }

  return runWithAccountRateLimitAcquireScope(async () => {
    try {
      await limiter.acquireOrDefer(params);
      const result = await fn();
      await limiter.commitLastAcquisition();

      return result;
    } catch (error) {
      await limiter.releaseLastAcquisition();

      throw error;
    }
  });
};
