jest.mock(
  'src/engine/core-modules/account-rate-limit/acquire-account-rate-limit.util',
  () => ({
    acquireAccountRateLimitOrDefer: jest.fn().mockResolvedValue(undefined),
    withAcquiredAccountRateLimit: jest.fn(
      async (_params: unknown, fn: () => Promise<unknown>) => fn(),
    ),
  }),
);

import { LinkedinUnipileRequestService } from '../linkedin-unipile-request.service';

describe('LinkedinUnipileRequestService profile cache', () => {
  const VALID_PROVIDER_ID = 'ACoAAabcdefghij1234567890';
  const profile = {
    public_identifier: 'jane-doe',
    provider_id: VALID_PROVIDER_ID,
    first_name: 'Jane',
  };

  const cache = {
    getLinkedinUserProfile: jest.fn(),
    saveLinkedinUserProfile: jest.fn().mockResolvedValue(undefined),
  };

  let service: LinkedinUnipileRequestService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LinkedinUnipileRequestService(
      {} as never,
      undefined,
      undefined,
      cache as never,
    );
  });

  it('returns a cached profile without calling Unipile', async () => {
    cache.getLinkedinUserProfile.mockResolvedValue(profile);
    const makeUnipileRequest = jest
      .spyOn(service, 'makeUnipileRequest')
      .mockResolvedValue({});

    await expect(
      service.fetchLinkedinUserProfile('acc-1', 'jane-doe'),
    ).resolves.toEqual(profile);

    expect(makeUnipileRequest).not.toHaveBeenCalled();
    expect(cache.saveLinkedinUserProfile).not.toHaveBeenCalled();
  });

  it('saves a fetched profile under public identifier and provider_id', async () => {
    cache.getLinkedinUserProfile.mockResolvedValue(null);
    jest.spyOn(service, 'makeUnipileRequest').mockResolvedValue(profile);

    await expect(
      service.fetchLinkedinUserProfile('acc-1', 'jane-doe'),
    ).resolves.toEqual(profile);

    expect(cache.saveLinkedinUserProfile).toHaveBeenCalledWith(
      'jane-doe',
      profile,
    );
    expect(cache.saveLinkedinUserProfile).toHaveBeenCalledWith(
      VALID_PROVIDER_ID,
      profile,
    );
  });
});
