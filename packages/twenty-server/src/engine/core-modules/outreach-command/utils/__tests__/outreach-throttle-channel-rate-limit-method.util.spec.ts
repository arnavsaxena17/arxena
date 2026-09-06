import { outreachThrottleChannelToLinkedinRateLimitMethod } from 'src/engine/core-modules/outreach-command/utils/outreach-throttle-channel-rate-limit-method.util';

describe('outreachThrottleChannelToLinkedinRateLimitMethod', () => {
  it('maps connect/message/comment and skips email', () => {
    expect(outreachThrottleChannelToLinkedinRateLimitMethod('connect')).toBe(
      'connection_request',
    );
    expect(outreachThrottleChannelToLinkedinRateLimitMethod('message')).toBe(
      'message',
    );
    expect(outreachThrottleChannelToLinkedinRateLimitMethod('comment')).toBe(
      'comment',
    );
    expect(
      outreachThrottleChannelToLinkedinRateLimitMethod('email'),
    ).toBeNull();
  });
});
