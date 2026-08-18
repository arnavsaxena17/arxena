import { CompanySearchDataSourceResolver } from '../company-search-data-source.resolver';

describe('CompanySearchDataSourceResolver', () => {
  const unipileSearchAccountResolver = {
    resolve: jest.fn(),
    resolvePoolAccount: jest.fn(),
    isUnipileConfigured: jest.fn().mockReturnValue(true),
  };
  const harvestLinkedinService = {
    isConfigured: jest.fn().mockReturnValue(false),
  };

  const resolver = new CompanySearchDataSourceResolver(
    unipileSearchAccountResolver as never,
    harvestLinkedinService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    harvestLinkedinService.isConfigured.mockReturnValue(false);
  });

  it('uses Unipile Sales Navigator on auto when a SN account is resolved', async () => {
    unipileSearchAccountResolver.resolve.mockResolvedValue({
      accountId: 'sn-acct',
      product: 'sales_navigator',
      via: 'workspace_sales_navigator',
    });

    await expect(resolver.resolve({ dataSource: 'auto' })).resolves.toEqual({
      dataSource: 'unipile',
      accountId: 'sn-acct',
      unipileProduct: 'sales_navigator',
    });
    expect(harvestLinkedinService.isConfigured).not.toHaveBeenCalled();
  });

  it('uses recruiter dataSource when auto resolves a Recruiter Unipile account', async () => {
    unipileSearchAccountResolver.resolve.mockResolvedValue({
      accountId: 'rec-acct',
      product: 'recruiter',
      via: 'member',
    });

    await expect(resolver.resolve({ apiToken: 'token' })).resolves.toEqual({
      dataSource: 'recruiter',
      accountId: 'rec-acct',
      unipileProduct: 'recruiter',
    });
  });

  it('falls back to harvest then index when Unipile is unavailable', async () => {
    unipileSearchAccountResolver.resolve.mockResolvedValue(null);
    harvestLinkedinService.isConfigured.mockReturnValue(true);

    await expect(resolver.resolve({ dataSource: 'auto' })).resolves.toEqual({
      dataSource: 'harvest',
    });

    harvestLinkedinService.isConfigured.mockReturnValue(false);

    await expect(resolver.resolve({ dataSource: 'auto' })).resolves.toEqual({
      dataSource: 'index',
    });
  });
});
