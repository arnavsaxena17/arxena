import {
    DEFAULT_WHATSAPP_OUTBOUND_MESSAGES_PER_MINUTE,
    resolveWhatsappOutboundMessagesPerMinute,
} from './whatsapp-outbound-rate-limit.util';

describe('resolveWhatsappOutboundMessagesPerMinute', () => {
  const originalEnv = process.env.WHATSAPP_OUTBOUND_MESSAGES_PER_MINUTE;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.WHATSAPP_OUTBOUND_MESSAGES_PER_MINUTE;
    } else {
      process.env.WHATSAPP_OUTBOUND_MESSAGES_PER_MINUTE = originalEnv;
    }
  });

  it('uses job value when set', () => {
    expect(
      resolveWhatsappOutboundMessagesPerMinute({
        whatsappOutboundMessagesPerMinute: 3,
      } as never),
    ).toBe(3);
  });

  it('falls back to env when job value is missing', () => {
    process.env.WHATSAPP_OUTBOUND_MESSAGES_PER_MINUTE = '8';
    expect(resolveWhatsappOutboundMessagesPerMinute(null)).toBe(8);
  });

  it('defaults to 5 when job and env are invalid', () => {
    delete process.env.WHATSAPP_OUTBOUND_MESSAGES_PER_MINUTE;
    expect(resolveWhatsappOutboundMessagesPerMinute(undefined)).toBe(
      DEFAULT_WHATSAPP_OUTBOUND_MESSAGES_PER_MINUTE,
    );
  });
});

describe('WhatsappOutboundRateLimiterService', () => {
  const sleepSpy = jest.spyOn(global, 'setTimeout');

  beforeEach(() => {
    jest.clearAllMocks();
    sleepSpy.mockImplementation((callback: () => void) => {
      callback();
      return 0 as unknown as NodeJS.Timeout;
    });
  });

  afterAll(() => {
    sleepSpy.mockRestore();
  });

  it('allows sends under the per-minute limit', async () => {
    const redisService = {
      tryAcquireSlidingWindowSlot: jest
        .fn()
        .mockResolvedValue({ acquired: true, waitMs: 0 }),
    };

    const { WhatsappOutboundRateLimiterService } = await import(
      './whatsapp-outbound-rate-limiter.service'
    );
    const limiter = new WhatsappOutboundRateLimiterService(
      redisService as never,
    );

    await limiter.waitForOutboundSlot('account-1', 5);

    expect(redisService.tryAcquireSlidingWindowSlot).toHaveBeenCalledTimes(1);
  });

  it('waits and retries when the sliding window is full', async () => {
    const redisService = {
      tryAcquireSlidingWindowSlot: jest
        .fn()
        .mockResolvedValueOnce({ acquired: false, waitMs: 250 })
        .mockResolvedValueOnce({ acquired: true, waitMs: 0 }),
    };

    const { WhatsappOutboundRateLimiterService } = await import(
      './whatsapp-outbound-rate-limiter.service'
    );
    const limiter = new WhatsappOutboundRateLimiterService(
      redisService as never,
    );

    await limiter.waitForOutboundSlot('account-1', 5);

    expect(redisService.tryAcquireSlidingWindowSlot).toHaveBeenCalledTimes(2);
  });
});

describe('RedisService.tryAcquireSlidingWindowSlot', () => {
  it('returns acquired when lua script returns 0', async () => {
    const redisClient = {
      eval: jest.fn().mockResolvedValue(0),
    };
    const { RedisService } = await import(
      '../ext-sock-whatsapp/redis-service-ops'
    );
    const redisService = new RedisService({ get: jest.fn() } as never);
    (redisService as unknown as { redisClient: typeof redisClient }).redisClient =
      redisClient;

    const result = await redisService.tryAcquireSlidingWindowSlot(
      'whatsapp-outbound:test',
      60_000,
      5,
      'member-1',
      1_000,
    );

    expect(result).toEqual({ acquired: true, waitMs: 0 });
    expect(redisClient.eval).toHaveBeenCalled();
  });

  it('returns waitMs when lua script returns positive delay', async () => {
    const redisClient = {
      eval: jest.fn().mockResolvedValue(1500),
    };
    const { RedisService } = await import(
      '../ext-sock-whatsapp/redis-service-ops'
    );
    const redisService = new RedisService({ get: jest.fn() } as never);
    (redisService as unknown as { redisClient: typeof redisClient }).redisClient =
      redisClient;

    const result = await redisService.tryAcquireSlidingWindowSlot(
      'whatsapp-outbound:test',
      60_000,
      5,
      'member-1',
      1_000,
    );

    expect(result).toEqual({ acquired: false, waitMs: 1500 });
  });
});
