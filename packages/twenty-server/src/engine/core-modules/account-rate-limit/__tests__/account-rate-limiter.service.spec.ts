import { RedisService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/redis-service-ops';
import { AccountRateLimiterService } from 'src/engine/core-modules/account-rate-limit/account-rate-limiter.service';
import { AccountRateLimitDeferredError } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';

describe('RedisService.tryAcquireMultiWindowSlots', () => {
  it('does not consume slots when lua returns a wait', async () => {
    const redisClient = {
      eval: jest.fn().mockResolvedValue(5_000),
    };
    const redisService = new RedisService({ get: jest.fn() } as never);
    (redisService as unknown as { redisClient: typeof redisClient }).redisClient =
      redisClient;

    const result = await redisService.tryAcquireMultiWindowSlots(
      [
        { key: 'linkedin:a:connection_request:30s', windowMs: 30_000, limit: 1 },
        { key: 'linkedin:a:connection_request:day', windowMs: 86_400_000, limit: 20 },
      ],
      'member-1',
      1_000,
    );

    expect(result).toEqual({ acquired: false, waitMs: 5_000 });
    expect(redisClient.eval).toHaveBeenCalledTimes(1);
  });

  it('returns acquired when lua returns 0', async () => {
    const redisClient = {
      eval: jest.fn().mockResolvedValue(0),
    };
    const redisService = new RedisService({ get: jest.fn() } as never);
    (redisService as unknown as { redisClient: typeof redisClient }).redisClient =
      redisClient;

    const result = await redisService.tryAcquireMultiWindowSlots(
      [{ key: 'linkedin:a:endpoint:minute', windowMs: 60_000, limit: 5 }],
      'member-1',
      1_000,
    );

    expect(result).toEqual({ acquired: true, waitMs: 0 });
  });
});

describe('AccountRateLimiterService', () => {
  const createLimiter = (
    acquire: jest.Mock,
  ): AccountRateLimiterService => {
    const redisService = {
      tryAcquireMultiWindowSlots: acquire,
      getString: jest.fn().mockResolvedValue(null),
      setString: jest.fn(),
    };
    const configService = {
      readCachedLinkedinLimits: jest.fn().mockResolvedValue(null),
      readCachedWhatsappLimits: jest.fn().mockResolvedValue(null),
    };

    return new AccountRateLimiterService(
      redisService as never,
      configService as never,
    );
  };

  it('isolates counters by account id', async () => {
    const acquire = jest.fn().mockResolvedValue({ acquired: true, waitMs: 0 });
    const limiter = createLimiter(acquire);

    await limiter.tryAcquire({
      provider: 'linkedin',
      accountId: 'acc-1',
      method: 'connection_request',
    });
    await limiter.tryAcquire({
      provider: 'linkedin',
      accountId: 'acc-2',
      method: 'connection_request',
    });

    const firstKeys = acquire.mock.calls[0][0].map(
      (window: { key: string }) => window.key,
    );
    const secondKeys = acquire.mock.calls[1][0].map(
      (window: { key: string }) => window.key,
    );

    expect(firstKeys.some((key: string) => key.includes('acc-1'))).toBe(true);
    expect(secondKeys.some((key: string) => key.includes('acc-2'))).toBe(true);
    expect(firstKeys).not.toEqual(secondKeys);
  });

  it('applies WhatsApp start-chat minute and day windows', async () => {
    const acquire = jest.fn().mockResolvedValue({ acquired: true, waitMs: 0 });
    const limiter = createLimiter(acquire);

    await limiter.tryAcquire({
      provider: 'whatsapp',
      accountId: 'wa-1',
      method: 'start_chat',
    });

    const keys = acquire.mock.calls[0][0].map(
      (window: { key: string }) => window.key,
    );

    expect(keys).toEqual(
      expect.arrayContaining([
        'whatsapp:wa-1:start_chat:minute',
        'whatsapp:wa-1:start_chat:day',
        'whatsapp:wa-1:endpoint:minute',
        'whatsapp:wa-1:endpoint:day',
      ]),
    );
  });

  it('applies LinkedIn message 30s and day windows', async () => {
    const acquire = jest.fn().mockResolvedValue({ acquired: true, waitMs: 0 });
    const limiter = createLimiter(acquire);

    await limiter.tryAcquire({
      provider: 'linkedin',
      accountId: 'acc-1',
      method: 'message',
    });

    const keys = acquire.mock.calls[0][0].map(
      (window: { key: string }) => window.key,
    );

    expect(keys).toEqual(
      expect.arrayContaining([
        'linkedin:acc-1:message:30s',
        'linkedin:acc-1:message:day',
        'linkedin:acc-1:endpoint:minute',
        'linkedin:acc-1:endpoint:day',
      ]),
    );
  });

  it('applies LinkedIn InMail 30s and day windows', async () => {
    const acquire = jest.fn().mockResolvedValue({ acquired: true, waitMs: 0 });
    const limiter = createLimiter(acquire);

    await limiter.tryAcquire({
      provider: 'linkedin',
      accountId: 'acc-1',
      method: 'inmail',
    });

    const keys = acquire.mock.calls[0][0].map(
      (window: { key: string }) => window.key,
    );

    expect(keys).toEqual(
      expect.arrayContaining([
        'linkedin:acc-1:inmail:30s',
        'linkedin:acc-1:inmail:day',
        'linkedin:acc-1:endpoint:minute',
        'linkedin:acc-1:endpoint:day',
      ]),
    );
  });

  it('applies LinkedIn comment 30s and day windows', async () => {
    const acquire = jest.fn().mockResolvedValue({ acquired: true, waitMs: 0 });
    const limiter = createLimiter(acquire);

    await limiter.tryAcquire({
      provider: 'linkedin',
      accountId: 'acc-1',
      method: 'comment',
    });

    const keys = acquire.mock.calls[0][0].map(
      (window: { key: string }) => window.key,
    );

    expect(keys).toEqual(
      expect.arrayContaining([
        'linkedin:acc-1:comment:30s',
        'linkedin:acc-1:comment:day',
        'linkedin:acc-1:endpoint:minute',
        'linkedin:acc-1:endpoint:day',
      ]),
    );
  });

  it('defers instead of waiting in-process when the wait exceeds the cap', async () => {
    const acquire = jest.fn().mockResolvedValue({
      acquired: false,
      waitMs: 3_600_000,
    });
    const limiter = createLimiter(acquire);

    await expect(
      limiter.acquireOrDefer({
        provider: 'linkedin',
        accountId: 'acc-1',
        method: 'connection_request',
        maxInProcessWaitMs: 1_000,
      }),
    ).rejects.toBeInstanceOf(AccountRateLimitDeferredError);
  });
});
