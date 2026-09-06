import { type LinkedinRateLimitMethod } from 'src/engine/core-modules/account-rate-limit/account-rate-limiter.service';
import { type OutreachThrottleChannel } from 'src/engine/core-modules/outreach-command/utils/outreach-throttle.util';

export const outreachThrottleChannelToLinkedinRateLimitMethod = (
  channel: OutreachThrottleChannel,
): LinkedinRateLimitMethod | null => {
  switch (channel) {
    case 'connect':
      return 'connection_request';
    case 'message':
      return 'message';
    case 'comment':
      return 'comment';
    case 'email':
      return null;
    default:
      return null;
  }
};
