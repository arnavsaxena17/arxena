import { AccountRateLimitConfigService } from 'src/engine/core-modules/account-rate-limit/account-rate-limit-config.service';
import { DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS } from 'twenty-shared/arx';
import { KeyValuePairType } from 'src/engine/core-modules/key-value-pair/key-value-pair.entity';

describe('AccountRateLimitConfigService', () => {
  it('round-trips per-account LinkedIn limits', async () => {
    const store = new Map<string, unknown>();
    const keyValuePairService = {
      get: jest.fn(async ({ key }: { key: string }) => {
        const value = store.get(key);
        return value == null ? [] : [{ value }];
      }),
      set: jest.fn(async ({ key, value }: { key: string; value: unknown }) => {
        store.set(key, value);
      }),
    };
    const redisService = {
      getString: jest.fn().mockResolvedValue(null),
      setString: jest.fn(),
    };
    const service = new AccountRateLimitConfigService(
      keyValuePairService as never,
      redisService as never,
    );

    const saved = await service.saveLinkedinLimits('ws-1', 'acc-1', {
      connectionRequestPerDay: 12,
    });

    expect(saved.connectionRequestPerDay).toBe(12);
    expect(saved.searchPerDay).toBe(DEFAULT_LINKEDIN_ACCOUNT_RATE_LIMITS.searchPerDay);
    expect(keyValuePairService.set).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        type: KeyValuePairType.USER_VARIABLE,
      }),
    );

    const loaded = await service.getLinkedinLimits('ws-1', 'acc-1');
    expect(loaded.connectionRequestPerDay).toBe(12);
  });
});
