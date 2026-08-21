import { AccountRateLimiterService } from './account-rate-limiter.service';

let registeredAccountRateLimiter: AccountRateLimiterService | undefined;

export const registerAccountRateLimiter = (
  service: AccountRateLimiterService,
): void => {
  registeredAccountRateLimiter = service;
};

export const getRegisteredAccountRateLimiter = ():
  | AccountRateLimiterService
  | undefined => registeredAccountRateLimiter;
