import { PeopleSalesNavAccountResolver } from '../people-sales-nav-account.resolver';

describe('PeopleSalesNavAccountResolver', () => {
  const harvestLinkedinService = {
    isConfigured: jest.fn().mockReturnValue(true),
  };

  const linkedinUnipileEstimateAccountService = {
    resolveSharedSalesNavigatorPoolAccountId: jest
      .fn()
      .mockResolvedValue('pool-account-1'),
  };

  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.UNIPILE_API_URL = 'https://api.unipile.test';
    process.env.UNIPILE_ACCESS_TOKEN = 'token';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const createResolver = () =>
    new PeopleSalesNavAccountResolver(
      harvestLinkedinService as never,
      linkedinUnipileEstimateAccountService as never,
    );

  it('resolves harvest without account id', async () => {
    const resolver = createResolver();
    await expect(
      resolver.resolve({ candidateSource: 'harvest' }),
    ).resolves.toEqual({ candidateSource: 'harvest' });
  });

  it('resolves pool via shared Sales Nav pool', async () => {
    const resolver = createResolver();
    await expect(
      resolver.resolve({ candidateSource: 'linkedin_pool' }),
    ).resolves.toEqual({
      candidateSource: 'linkedin_pool',
      linkedinUnipileAccountId: 'pool-account-1',
    });
  });

  it('requires accountId for unipile', async () => {
    const resolver = createResolver();
    await expect(
      resolver.resolve({ candidateSource: 'linkedin' }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('accepts explicit unipile accountId', async () => {
    const resolver = createResolver();
    await expect(
      resolver.resolve({
        candidateSource: 'linkedin',
        accountId: 'acct-1',
      }),
    ).resolves.toEqual({
      candidateSource: 'linkedin',
      linkedinUnipileAccountId: 'acct-1',
    });
  });

  it('fails closed when no source provided', async () => {
    const resolver = createResolver();
    await expect(resolver.resolve({})).rejects.toMatchObject({ status: 400 });
  });
});
