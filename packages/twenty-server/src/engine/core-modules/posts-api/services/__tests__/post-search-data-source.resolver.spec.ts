import { HttpException } from '@nestjs/common';

import { PostSearchDataSourceResolver } from '../post-search-data-source.resolver';

describe('PostSearchDataSourceResolver', () => {
  const unipileSearchAccountResolver = {
    resolve: jest.fn(),
    resolvePoolAccount: jest.fn(),
  };
  const harvestLinkedinService = {
    isConfigured: jest.fn().mockReturnValue(false),
  };

  const resolver = new PostSearchDataSourceResolver(
    unipileSearchAccountResolver as never,
    harvestLinkedinService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    harvestLinkedinService.isConfigured.mockReturnValue(false);
  });

  it('prefers Unipile Sales Navigator on auto', async () => {
    unipileSearchAccountResolver.resolve.mockResolvedValue({
      accountId: 'sn-acct',
      product: 'sales_navigator',
      via: 'workspace_sales_navigator',
    });

    await expect(resolver.resolve({ dataSource: 'auto' })).resolves.toEqual({
      dataSource: 'unipile',
      accountId: 'sn-acct',
    });
  });

  it('falls back to harvest then errors when nothing is configured', async () => {
    unipileSearchAccountResolver.resolve.mockResolvedValue(null);
    harvestLinkedinService.isConfigured.mockReturnValue(true);

    await expect(resolver.resolve({})).resolves.toEqual({
      dataSource: 'harvest',
    });

    harvestLinkedinService.isConfigured.mockReturnValue(false);

    await expect(resolver.resolve({})).rejects.toBeInstanceOf(HttpException);
  });

  it('resolves the pool account when pool is requested', async () => {
    unipileSearchAccountResolver.resolvePoolAccount.mockResolvedValue({
      accountId: 'pool-acct',
    });

    await expect(resolver.resolve({ dataSource: 'pool' })).resolves.toEqual({
      dataSource: 'pool',
      accountId: 'pool-acct',
    });
  });
});
