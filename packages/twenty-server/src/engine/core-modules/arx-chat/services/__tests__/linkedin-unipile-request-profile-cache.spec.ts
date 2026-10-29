jest.mock(
  'src/engine/core-modules/account-rate-limit/acquire-account-rate-limit.util',
  () => ({
    acquireAccountRateLimitOrDefer: jest.fn().mockResolvedValue(undefined),
    withAcquiredAccountRateLimit: jest.fn(
      async (_params: unknown, fn: () => Promise<unknown>) => fn(),
    ),
  }),
);

import { LINKEDIN_USER_PROFILE_CACHE_PREFIX } from 'src/engine/core-modules/cache-storage/constants/linkedin-provider-query-cache.const';
import { LinkedinUnipileRequestService } from '../linkedin-unipile-request.service';

describe('LinkedinUnipileRequestService profile cache', () => {
  const VALID_PROVIDER_ID = 'ACoAAabcdefghij1234567890';
  const profile = {
    public_identifier: 'jane-doe',
    provider_id: VALID_PROVIDER_ID,
    first_name: 'Jane',
  };

  const cache = {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
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
    cache.get.mockResolvedValue(profile);
    const makeUnipileRequest = jest
      .spyOn(service, 'makeUnipileRequest')
      .mockResolvedValue({});

    await expect(
      service.fetchLinkedinUserProfile('acc-1', 'jane-doe'),
    ).resolves.toEqual(profile);

    expect(makeUnipileRequest).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
    expect(cache.get).toHaveBeenCalledWith(LINKEDIN_USER_PROFILE_CACHE_PREFIX, {
      slug: 'jane-doe',
    });
  });

  it('saves a fetched profile under public identifier and provider_id', async () => {
    cache.get.mockResolvedValue(undefined);
    jest.spyOn(service, 'makeUnipileRequest').mockResolvedValue(profile);

    await expect(
      service.fetchLinkedinUserProfile('acc-1', 'jane-doe'),
    ).resolves.toEqual(profile);

    expect(cache.set).toHaveBeenCalledWith(
      LINKEDIN_USER_PROFILE_CACHE_PREFIX,
      { slug: 'jane-doe' },
      profile,
    );
    expect(cache.set).toHaveBeenCalledWith(
      LINKEDIN_USER_PROFILE_CACHE_PREFIX,
      { slug: VALID_PROVIDER_ID.toLowerCase() },
      profile,
    );
  });

  it('serves View LinkedIn profile (notify) from cache without calling Unipile', async () => {
    cache.get.mockResolvedValue(profile);
    const makeUnipileRequest = jest
      .spyOn(service, 'makeUnipileRequest')
      .mockResolvedValue({});

    await expect(
      service.visitLinkedinProfileNotify('acc-1', 'jane-doe'),
    ).resolves.toEqual(profile);

    expect(makeUnipileRequest).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('does not write sparse notify responses into the profile cache', async () => {
    cache.get.mockResolvedValue(undefined);
    jest.spyOn(service, 'makeUnipileRequest').mockResolvedValue(profile);

    await expect(
      service.visitLinkedinProfileNotify('acc-1', 'jane-doe'),
    ).resolves.toEqual(profile);

    expect(cache.set).not.toHaveBeenCalled();
  });
});
