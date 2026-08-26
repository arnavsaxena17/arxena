import { AccountRateLimitDeferredError } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';
import { registerAccountRateLimiter } from 'src/engine/core-modules/account-rate-limit/account-rate-limiter.registry';
import { AccountRateLimiterService } from 'src/engine/core-modules/account-rate-limit/account-rate-limiter.service';
import { withAcquiredAccountRateLimit } from 'src/engine/core-modules/account-rate-limit/acquire-account-rate-limit.util';

describe('withAcquiredAccountRateLimit', () => {
  const createLimiter = (acquire: jest.Mock) => {
    const redisService = {
      tryAcquireMultiWindowSlots: acquire,
      addSetMembers: jest.fn().mockResolvedValue(undefined),
      removeSetMembers: jest.fn().mockResolvedValue(undefined),
      removeMemberFromWindows: jest.fn().mockResolvedValue(2),
      getSetMembers: jest.fn().mockResolvedValue([]),
      deleteKeys: jest.fn().mockResolvedValue(0),
      getString: jest.fn().mockResolvedValue(null),
      setString: jest.fn(),
      deleteByPattern: jest.fn().mockResolvedValue(0),
    };
    const limiter = new AccountRateLimiterService(
      redisService as never,
      {
        readCachedLinkedinLimits: jest.fn().mockResolvedValue(null),
        readCachedWhatsappLimits: jest.fn().mockResolvedValue(null),
      } as never,
    );

    return { limiter, redisService };
  };

  afterEach(() => {
    registerAccountRateLimiter(undefined as never);
  });

  it.each([
    'connection_request',
    'search',
    'comment',
    'message',
    'inmail',
    'endpoint',
  ] as const)('keeps the %s slot after a successful Unipile call', async (method) => {
    const { limiter, redisService } = createLimiter(
      jest.fn().mockResolvedValue({ acquired: true, waitMs: 0 }),
    );
    registerAccountRateLimiter(limiter);

    await expect(
      withAcquiredAccountRateLimit(
        { provider: 'linkedin', accountId: 'acc-1', method },
        async () => 'sent',
      ),
    ).resolves.toBe('sent');

    expect(redisService.removeMemberFromWindows).not.toHaveBeenCalled();
  });

  it('releases the slot when the Unipile call fails before send', async () => {
    const { limiter, redisService } = createLimiter(
      jest.fn().mockResolvedValue({ acquired: true, waitMs: 0 }),
    );
    registerAccountRateLimiter(limiter);

    await expect(
      withAcquiredAccountRateLimit(
        {
          provider: 'linkedin',
          accountId: 'acc-1',
          method: 'connection_request',
        },
        async () => {
          throw new Error('Unipile 500');
        },
      ),
    ).rejects.toThrow('Unipile 500');

    expect(redisService.removeMemberFromWindows).toHaveBeenCalledWith(
      [
        'linkedin:acc-1:connection_request:5m',
        'linkedin:acc-1:connection_request:day',
      ],
      expect.any(String),
    );
  });

  it('keeps a deferred reservation so later stop can free it', async () => {
    const { limiter, redisService } = createLimiter(
      jest.fn().mockResolvedValue({ acquired: false, waitMs: 3_600_000 }),
    );
    registerAccountRateLimiter(limiter);

    await expect(
      withAcquiredAccountRateLimit(
        {
          provider: 'linkedin',
          accountId: 'acc-1',
          method: 'connection_request',
        },
        async () => 'should not run',
      ),
    ).rejects.toBeInstanceOf(AccountRateLimitDeferredError);

    expect(redisService.removeMemberFromWindows).not.toHaveBeenCalled();
  });
});
