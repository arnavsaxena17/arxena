import { RedisService } from 'src/engine/core-modules/arx-chat/services/ext-sock-whatsapp/redis-service-ops';
import {
  AccountRateLimiterService,
  buildAccountRateLimitUsageScanPattern,
} from 'src/engine/core-modules/account-rate-limit/account-rate-limiter.service';
import { AccountRateLimitDeferredError } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-deferred.error';
import {
  runWithAccountRateLimitAcquireScope,
  runWithAccountRateLimitReservation,
} from 'src/engine/core-modules/account-rate-limit/account-rate-limit-reservation.context';

describe('RedisService.tryAcquireMultiWindowSlots', () => {
  it('reserves a future slot when lua returns a wait', async () => {
    const redisClient = {
      eval: jest.fn().mockResolvedValue(5_000),
    };
    const redisService = new RedisService({ get: jest.fn() } as never);
    (
      redisService as unknown as { redisClient: typeof redisClient }
    ).redisClient = redisClient;

    const result = await redisService.tryAcquireMultiWindowSlots(
      [
        {
          key: 'linkedin:a:connection_request:5m',
          windowMs: 300_000,
          limit: 1,
          pace: true,
        },
        {
          key: 'linkedin:a:connection_request:day',
          windowMs: 86_400_000,
          limit: 20,
          pace: false,
        },
      ],
      'member-1',
      1_000,
    );

    expect(result).toEqual({ acquired: false, waitMs: 5_000 });
    expect(redisClient.eval).toHaveBeenCalledTimes(1);
    expect(redisClient.eval.mock.calls[0].slice(4, 13)).toEqual([
      '1000',
      'member-1',
      '2',
      '300000',
      '1',
      '1',
      '86400000',
      '20',
      '0',
    ]);
  });

  it('returns acquired when lua returns 0', async () => {
    const redisClient = {
      eval: jest.fn().mockResolvedValue(0),
    };
    const redisService = new RedisService({ get: jest.fn() } as never);
    (
      redisService as unknown as { redisClient: typeof redisClient }
    ).redisClient = redisClient;

    const result = await redisService.tryAcquireMultiWindowSlots(
      [{ key: 'linkedin:a:endpoint:minute', windowMs: 60_000, limit: 5 }],
      'member-1',
      1_000,
    );

    expect(result).toEqual({ acquired: true, waitMs: 0 });
  });
});

describe('RedisService.deleteByPattern', () => {
  it('scans and deletes matching keys', async () => {
    const redisClient = {
      scan: jest
        .fn()
        .mockResolvedValueOnce(['1', ['linkedin:acc-1:search:day']])
        .mockResolvedValueOnce(['0', ['linkedin:acc-1:endpoint:minute']]),
      del: jest.fn().mockResolvedValue(1),
    };
    const redisService = new RedisService({ get: jest.fn() } as never);
    (
      redisService as unknown as { redisClient: typeof redisClient }
    ).redisClient = redisClient;

    const deleted = await redisService.deleteByPattern('linkedin:acc-1:*');

    expect(deleted).toBe(2);
    expect(redisClient.scan).toHaveBeenCalledTimes(2);
    expect(redisClient.del).toHaveBeenNthCalledWith(
      1,
      'linkedin:acc-1:search:day',
    );
    expect(redisClient.del).toHaveBeenNthCalledWith(
      2,
      'linkedin:acc-1:endpoint:minute',
    );
  });

  it('deletes exact keys', async () => {
    const redisClient = {
      del: jest.fn().mockResolvedValue(1),
    };
    const redisService = new RedisService({ get: jest.fn() } as never);
    (
      redisService as unknown as { redisClient: typeof redisClient }
    ).redisClient = redisClient;

    await expect(
      redisService.deleteKeys('linkedin:acc-1:connection_request:5m'),
    ).resolves.toBe(1);
    expect(redisClient.del).toHaveBeenCalledWith(
      'linkedin:acc-1:connection_request:5m',
    );
  });
});

describe('RedisService.countSlidingWindowMembers', () => {
  it('counts members still inside each window without mutating keys', async () => {
    const pipeline = {
      zcount: jest.fn(),
      exec: jest.fn().mockResolvedValue([
        [null, 2],
        [null, 0],
      ]),
    };
    const redisClient = {
      pipeline: jest.fn().mockReturnValue(pipeline),
    };
    const redisService = new RedisService({ get: jest.fn() } as never);
    (
      redisService as unknown as { redisClient: typeof redisClient }
    ).redisClient = redisClient;

    const counts = await redisService.countSlidingWindowMembers(
      [
        { key: 'linkedin:a:connection_request:5m', windowMs: 300_000 },
        { key: 'linkedin:a:connection_request:day', windowMs: 86_400_000 },
      ],
      1_000_000,
    );

    expect(counts).toEqual([2, 0]);
    expect(pipeline.zcount).toHaveBeenNthCalledWith(
      1,
      'linkedin:a:connection_request:5m',
      '(700000',
      '+inf',
    );
    expect(pipeline.zcount).toHaveBeenNthCalledWith(
      2,
      'linkedin:a:connection_request:day',
      '(-85400000',
      '+inf',
    );
  });

  it('counts paced windows up to now so future reserved slots are excluded', async () => {
    const pipeline = {
      zcount: jest.fn(),
      exec: jest.fn().mockResolvedValue([[null, 1]]),
    };
    const redisClient = {
      pipeline: jest.fn().mockReturnValue(pipeline),
    };
    const redisService = new RedisService({ get: jest.fn() } as never);
    (
      redisService as unknown as { redisClient: typeof redisClient }
    ).redisClient = redisClient;

    await redisService.countSlidingWindowMembers(
      [
        {
          key: 'linkedin:a:connection_request:5m',
          windowMs: 300_000,
          maxScore: 1_000_000,
        },
      ],
      1_000_000,
    );

    expect(pipeline.zcount).toHaveBeenCalledWith(
      'linkedin:a:connection_request:5m',
      '(700000',
      1_000_000,
    );
  });
});

describe('RedisService.removeMemberFromWindows', () => {
  it('removes the lua member suffix from each window', async () => {
    const pipeline = {
      zrem: jest.fn(),
      exec: jest.fn().mockResolvedValue([
        [null, 1],
        [null, 1],
      ]),
    };
    const redisClient = {
      pipeline: jest.fn().mockReturnValue(pipeline),
    };
    const redisService = new RedisService({ get: jest.fn() } as never);
    (
      redisService as unknown as { redisClient: typeof redisClient }
    ).redisClient = redisClient;

    await expect(
      redisService.removeMemberFromWindows(
        [
          'linkedin:a:connection_request:5m',
          'linkedin:a:connection_request:day',
        ],
        'run-1:step-1:0',
      ),
    ).resolves.toBe(2);
    expect(pipeline.zrem).toHaveBeenNthCalledWith(
      1,
      'linkedin:a:connection_request:5m',
      'run-1:step-1:0:1',
    );
    expect(pipeline.zrem).toHaveBeenNthCalledWith(
      2,
      'linkedin:a:connection_request:day',
      'run-1:step-1:0:2',
    );
  });
});

describe('AccountRateLimiterService', () => {
  const createLimiter = (acquire: jest.Mock): AccountRateLimiterService => {
    const redisService = {
      tryAcquireMultiWindowSlots: acquire,
      getString: jest.fn().mockResolvedValue(null),
      setString: jest.fn(),
      deleteKeys: jest.fn().mockResolvedValue(0),
      deleteByPattern: jest.fn().mockResolvedValue(0),
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
      ]),
    );
    expect(keys).not.toContain('whatsapp:wa-1:endpoint:minute');
    expect(keys).not.toContain('whatsapp:wa-1:endpoint:day');
    expect(keys).toHaveLength(2);
  });

  it('applies LinkedIn connection request 5-minute and day windows', async () => {
    const acquire = jest.fn().mockResolvedValue({ acquired: true, waitMs: 0 });
    const limiter = createLimiter(acquire);

    await limiter.tryAcquire({
      provider: 'linkedin',
      accountId: 'acc-1',
      method: 'connection_request',
    });

    const windows = acquire.mock.calls[0][0] as Array<{
      key: string;
      windowMs: number;
      limit: number;
    }>;
    const keys = windows.map((window) => window.key);

    expect(keys).toEqual([
      'linkedin:acc-1:connection_request:5m',
      'linkedin:acc-1:connection_request:day',
    ]);
    expect(windows).toEqual([
      expect.objectContaining({
        key: 'linkedin:acc-1:connection_request:5m',
        windowMs: 300_000,
        limit: 1,
        pace: true,
      }),
      expect.objectContaining({
        key: 'linkedin:acc-1:connection_request:day',
        windowMs: 86_400_000,
        limit: 20,
        pace: false,
      }),
    ]);
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

    expect(keys).toEqual([
      'linkedin:acc-1:message:30s',
      'linkedin:acc-1:message:day',
    ]);
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

    expect(keys).toEqual([
      'linkedin:acc-1:inmail:30s',
      'linkedin:acc-1:inmail:day',
    ]);
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

    expect(keys).toEqual([
      'linkedin:acc-1:comment:30s',
      'linkedin:acc-1:comment:day',
    ]);
  });

  it('applies LinkedIn search minute and day windows without the shared endpoint cap', async () => {
    const acquire = jest.fn().mockResolvedValue({ acquired: true, waitMs: 0 });
    const limiter = createLimiter(acquire);

    await limiter.tryAcquire({
      provider: 'linkedin',
      accountId: 'acc-1',
      method: 'search',
    });

    const keys = acquire.mock.calls[0][0].map(
      (window: { key: string }) => window.key,
    );

    expect(keys).toEqual([
      'linkedin:acc-1:search:minute',
      'linkedin:acc-1:search:day',
    ]);
    expect(acquire.mock.calls[0][0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'linkedin:acc-1:search:minute',
          pace: true,
        }),
        expect.objectContaining({
          key: 'linkedin:acc-1:search:day',
          pace: false,
        }),
      ]),
    );
  });

  it('uses profile pace plus dedicated profile day for profile lookups', async () => {
    const acquire = jest.fn().mockResolvedValue({ acquired: true, waitMs: 0 });
    const limiter = createLimiter(acquire);

    await limiter.tryAcquire({
      provider: 'linkedin',
      accountId: 'acc-1',
      method: 'profile',
    });

    const keys = acquire.mock.calls[0][0].map(
      (window: { key: string }) => window.key,
    );

    expect(keys).toEqual([
      'linkedin:acc-1:profile:10s',
      'linkedin:acc-1:profile:day',
    ]);
  });

  it('uses company-profile pace plus dedicated company profile day', async () => {
    const acquire = jest.fn().mockResolvedValue({ acquired: true, waitMs: 0 });
    const limiter = createLimiter(acquire);

    await limiter.tryAcquire({
      provider: 'linkedin',
      accountId: 'acc-1',
      method: 'company_profile',
    });

    const keys = acquire.mock.calls[0][0].map(
      (window: { key: string }) => window.key,
    );

    expect(keys).toEqual([
      'linkedin:acc-1:company_profile:10s',
      'linkedin:acc-1:company_profile:day',
    ]);
  });

  it('forwards an explicit reservation member to Redis', async () => {
    const acquire = jest.fn().mockResolvedValue({ acquired: true, waitMs: 0 });
    const limiter = createLimiter(acquire);

    await limiter.tryAcquire({
      provider: 'linkedin',
      accountId: 'acc-1',
      method: 'search',
      member: 'run-1:step-1:0',
    });

    expect(acquire.mock.calls[0][1]).toBe('run-1:step-1:0');
  });

  it('passes a reservation member into Redis acquire', async () => {
    const acquire = jest.fn().mockResolvedValue({ acquired: true, waitMs: 0 });
    const limiter = createLimiter(acquire);

    await limiter.acquireOrDefer({
      provider: 'linkedin',
      accountId: 'acc-1',
      method: 'search',
    });

    expect(typeof acquire.mock.calls[0][1]).toBe('string');
    expect(acquire.mock.calls[0][1].length).toBeGreaterThan(0);
  });

  it('reserves future slots relative to asOfMs for send-window pre-booking', async () => {
    const windowOpenMs = 1_700_000_000_000;
    const acquire = jest
      .fn()
      .mockResolvedValueOnce({ acquired: true, waitMs: 0 })
      .mockResolvedValueOnce({ acquired: false, waitMs: 300_000 });
    const limiter = createLimiter(acquire);

    await limiter.tryAcquire({
      provider: 'linkedin',
      accountId: 'acc-1',
      method: 'connection_request',
      asOfMs: windowOpenMs,
      member: 'run-1:step-1:0',
    });
    await limiter.tryAcquire({
      provider: 'linkedin',
      accountId: 'acc-1',
      method: 'connection_request',
      asOfMs: windowOpenMs,
      member: 'run-2:step-1:0',
    });

    expect(acquire.mock.calls[0][2]).toBe(windowOpenMs);
    expect(acquire.mock.calls[1][2]).toBe(windowOpenMs);
  });

  it('defers instead of waiting in-process when the wait exceeds the cap', async () => {
    const acquire = jest.fn().mockResolvedValue({
      acquired: false,
      waitMs: 3_600_000,
    });
    const removeMemberFromWindows = jest.fn().mockResolvedValue(2);
    const redisService = {
      tryAcquireMultiWindowSlots: acquire,
      addSetMembers: jest.fn().mockResolvedValue(undefined),
      removeSetMembers: jest.fn().mockResolvedValue(undefined),
      removeMemberFromWindows,
      getString: jest.fn().mockResolvedValue(null),
      setString: jest.fn(),
      deleteKeys: jest.fn().mockResolvedValue(0),
      deleteByPattern: jest.fn().mockResolvedValue(0),
    };
    const limiter = new AccountRateLimiterService(
      redisService as never,
      {
        readCachedLinkedinLimits: jest.fn().mockResolvedValue(null),
        readCachedWhatsappLimits: jest.fn().mockResolvedValue(null),
      } as never,
    );

    await expect(
      runWithAccountRateLimitAcquireScope(async () =>
        limiter.acquireOrDefer({
          provider: 'linkedin',
          accountId: 'acc-1',
          method: 'connection_request',
          maxInProcessWaitMs: 1_000,
        }),
      ),
    ).rejects.toBeInstanceOf(AccountRateLimitDeferredError);

    expect(removeMemberFromWindows).not.toHaveBeenCalled();
  });

  it('flushes only this account usage keys and skips empty account ids', async () => {
    const deleteByPattern = jest.fn().mockResolvedValue(7);
    const deleteKeys = jest.fn().mockResolvedValue(1);
    const limiter = new AccountRateLimiterService(
      {
        tryAcquireMultiWindowSlots: jest.fn(),
        getString: jest.fn(),
        setString: jest.fn(),
        deleteKeys,
        deleteByPattern,
      } as never,
      {
        readCachedLinkedinLimits: jest.fn(),
        readCachedWhatsappLimits: jest.fn(),
      } as never,
    );

    await expect(
      limiter.flushUsage({ provider: 'linkedin', accountId: '   ' }),
    ).resolves.toEqual({ deletedKeys: 0 });
    expect(deleteByPattern).not.toHaveBeenCalled();
    expect(deleteKeys).not.toHaveBeenCalled();

    await expect(
      limiter.flushUsage({ provider: 'linkedin', accountId: 'acc-1' }),
    ).resolves.toEqual({ deletedKeys: 7 });
    expect(deleteByPattern).toHaveBeenCalledWith('linkedin:acc-1:*');
    expect(deleteByPattern.mock.calls[0][0]).not.toContain(
      'account-rate-limits-config',
    );

    await expect(
      limiter.flushUsage({
        provider: 'linkedin',
        accountId: 'acc-1',
        method: 'connection_request',
        windowName: '5m',
      }),
    ).resolves.toEqual({ deletedKeys: 1 });
    expect(deleteKeys).toHaveBeenCalledWith(
      'linkedin:acc-1:connection_request:5m',
    );
    expect(deleteByPattern).toHaveBeenCalledTimes(1);
  });

  it('returns used request counts for each LinkedIn field', async () => {
    const getSlidingWindowUsageBreakdown = jest.fn(
      async (windows: Array<{ key: string; windowMs: number }>) =>
        windows.map((window) =>
          window.key === 'linkedin:acc-1:connection_request:5m'
            ? { used: 3, reserved: 0, maxScore: Date.now() - 1_000 }
            : { used: 0, reserved: 0, maxScore: null },
        ),
    );
    const limiter = new AccountRateLimiterService(
      {
        tryAcquireMultiWindowSlots: jest.fn(),
        getSlidingWindowUsageBreakdown,
        getString: jest.fn(),
        setString: jest.fn(),
        deleteKeys: jest.fn(),
        deleteByPattern: jest.fn(),
      } as never,
      {
        readCachedLinkedinLimits: jest.fn(),
        readCachedWhatsappLimits: jest.fn(),
      } as never,
    );

    const usage = await limiter.getUsage({
      provider: 'linkedin',
      accountId: 'acc-1',
    });

    expect(usage.connectionRequestPer5Minutes).toBe(3);
    expect(usage.searchPerDay).toBe(0);
    expect(getSlidingWindowUsageBreakdown).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'linkedin:acc-1:connection_request:5m',
          windowMs: 300_000,
        }),
        expect.objectContaining({
          key: 'linkedin:acc-1:profile:day',
          windowMs: 86_400_000,
        }),
        expect.objectContaining({
          key: 'linkedin:acc-1:search:day',
          windowMs: 86_400_000,
        }),
        expect.objectContaining({
          key: 'linkedin:acc-1:connection_request:day',
          windowMs: 86_400_000,
        }),
      ]),
      expect.any(Number),
    );
  });

  it('returns reserved future slots without counting them as used', async () => {
    const nextSlotMs = Date.now() + 2 * 24 * 60 * 60 * 1000;
    const getSlidingWindowUsageBreakdown = jest.fn(
      async (windows: Array<{ key: string; windowMs: number }>) =>
        windows.map((window) =>
          window.key === 'linkedin:acc-1:connection_request:5m'
            ? { used: 0, reserved: 5, maxScore: nextSlotMs }
            : { used: 0, reserved: 0, maxScore: null },
        ),
    );
    const limiter = new AccountRateLimiterService(
      {
        tryAcquireMultiWindowSlots: jest.fn(),
        getSlidingWindowUsageBreakdown,
        getString: jest.fn(),
        setString: jest.fn(),
        deleteKeys: jest.fn(),
        deleteByPattern: jest.fn(),
      } as never,
      {
        readCachedLinkedinLimits: jest.fn(),
        readCachedWhatsappLimits: jest.fn(),
      } as never,
    );

    const breakdown = await limiter.getUsageBreakdown({
      provider: 'linkedin',
      accountId: 'acc-1',
    });

    expect(breakdown.connectionRequestPer5Minutes).toEqual({
      used: 0,
      reserved: 5,
      nextSlotAt: new Date(nextSlotMs).toISOString(),
    });
    expect(breakdown.searchPerDay).toEqual({
      used: 0,
      reserved: 0,
      nextSlotAt: null,
    });
  });

  it('returns no usage for an empty account id', async () => {
    const getSlidingWindowUsageBreakdown = jest.fn();
    const limiter = new AccountRateLimiterService(
      {
        tryAcquireMultiWindowSlots: jest.fn(),
        getSlidingWindowUsageBreakdown,
        getString: jest.fn(),
        setString: jest.fn(),
        deleteKeys: jest.fn(),
        deleteByPattern: jest.fn(),
      } as never,
      {
        readCachedLinkedinLimits: jest.fn(),
        readCachedWhatsappLimits: jest.fn(),
      } as never,
    );

    await expect(
      limiter.getUsage({ provider: 'linkedin', accountId: '  ' }),
    ).resolves.toEqual({});
    await expect(
      limiter.getUsageBreakdown({ provider: 'linkedin', accountId: '  ' }),
    ).resolves.toEqual({});
    expect(getSlidingWindowUsageBreakdown).not.toHaveBeenCalled();
  });

  it('escapes redis glob characters in account ids', () => {
    expect(buildAccountRateLimitUsageScanPattern('linkedin', 'acc-*x')).toBe(
      'linkedin:acc-\\*x:*',
    );
    expect(
      buildAccountRateLimitUsageScanPattern('linkedin', 'acc-1', 'search'),
    ).toBe('linkedin:acc-1:search:*');
  });

  it('keeps successful slots and releases unused ones for a stopped workflow', async () => {
    const workflowRunId = '54a99d20-8be6-4869-8eeb-aa1aeadfb694';
    const addSetMembers = jest.fn().mockResolvedValue(undefined);
    const removeSetMembers = jest.fn().mockResolvedValue(undefined);
    const getSetMembers = jest.fn().mockResolvedValue([]);
    const removeMemberFromWindows = jest.fn().mockResolvedValue(2);
    const deleteKeys = jest.fn().mockResolvedValue(1);
    const limiter = new AccountRateLimiterService(
      {
        tryAcquireMultiWindowSlots: jest
          .fn()
          .mockResolvedValue({ acquired: true, waitMs: 0 }),
        addSetMembers,
        removeSetMembers,
        getSetMembers,
        removeMemberFromWindows,
        deleteKeys,
        deleteByPattern: jest.fn(),
        getString: jest.fn().mockResolvedValue(null),
        setString: jest.fn(),
      } as never,
      {
        readCachedLinkedinLimits: jest.fn().mockResolvedValue(null),
        readCachedWhatsappLimits: jest.fn().mockResolvedValue(null),
      } as never,
    );

    await runWithAccountRateLimitReservation(
      `${workflowRunId}:step-1`,
      async () => {
        await runWithAccountRateLimitAcquireScope(async () => {
          await limiter.tryAcquire({
            provider: 'linkedin',
            accountId: 'acc-1',
            method: 'connection_request',
            member: `${workflowRunId}:step-1:0`,
          });
          await limiter.commitLastAcquisition();
        });
      },
    );

    expect(addSetMembers).toHaveBeenCalledTimes(1);
    expect(removeSetMembers).toHaveBeenCalledTimes(1);
    expect(removeMemberFromWindows).not.toHaveBeenCalled();

    await runWithAccountRateLimitReservation(
      `${workflowRunId}:step-2`,
      async () => {
        await runWithAccountRateLimitAcquireScope(async () => {
          await limiter.tryAcquire({
            provider: 'linkedin',
            accountId: 'acc-1',
            method: 'search',
            member: `${workflowRunId}:step-2:0`,
          });
          await limiter.releaseLastAcquisition();
        });
      },
    );

    expect(removeMemberFromWindows).toHaveBeenCalledWith(
      ['linkedin:acc-1:search:minute', 'linkedin:acc-1:search:day'],
      `${workflowRunId}:step-2:0`,
    );

    await runWithAccountRateLimitReservation(
      `${workflowRunId}:step-3`,
      async () => {
        await runWithAccountRateLimitAcquireScope(async () => {
          await limiter.tryAcquire({
            provider: 'linkedin',
            accountId: 'acc-1',
            method: 'comment',
            member: `${workflowRunId}:step-3:0`,
          });
        });
      },
    );

    const ghostPayload = addSetMembers.mock.calls.at(-1)?.[1][0] as string;
    getSetMembers.mockResolvedValue([ghostPayload]);

    await limiter.releaseGhostReservationsForWorkflowRun(workflowRunId);

    expect(removeMemberFromWindows).toHaveBeenCalledWith(
      ['linkedin:acc-1:comment:30s', 'linkedin:acc-1:comment:day'],
      `${workflowRunId}:step-3:0`,
    );
    expect(deleteKeys).toHaveBeenCalledWith(
      `account-rate-limit-ghost:${workflowRunId}`,
    );
  });
});
