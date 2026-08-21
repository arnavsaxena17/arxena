import { getRegisteredAccountRateLimiter } from 'src/engine/core-modules/account-rate-limit/account-rate-limiter.registry';
import {
  type AccountRateLimitMethod,
  type AccountRateLimitProvider,
} from 'src/engine/core-modules/account-rate-limit/account-rate-limiter.service';

export const acquireAccountRateLimitOrDefer = async (params: {
  provider: AccountRateLimitProvider;
  accountId: string;
  method: AccountRateLimitMethod;
  startChatPerMinuteOverride?: number;
}): Promise<void> => {
  const limiter = getRegisteredAccountRateLimiter();
  if (!limiter) {
    return;
  }

  await limiter.acquireOrDefer(params);
};
