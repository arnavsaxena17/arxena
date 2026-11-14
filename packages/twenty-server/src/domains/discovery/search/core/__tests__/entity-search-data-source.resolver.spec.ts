import { HttpException } from '@nestjs/common';

import { EntitySearchDataSourceResolver } from '../search-data-source';

// One resolver now serves companies, jobs and posts. The entity policies differ
// only in the fallback when nothing is configured and whether the Unipile
// product is reported, so each entity keeps its own expectations here.
describe('EntitySearchDataSourceResolver', () => {
  const unipileSearchAccountResolver = {
    resolve: jest.fn(),
    resolvePoolAccount: jest.fn(),
    isUnipileConfigured: jest.fn().mockReturnValue(true),
  };
  const harvestLinkedinService = {
    isConfigured: jest.fn().mockReturnValue(false),
  };

  const resolver = new EntitySearchDataSourceResolver(
    unipileSearchAccountResolver as never,
    harvestLinkedinService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    harvestLinkedinService.isConfigured.mockReturnValue(false);
  });

  describe('jobs', () => {
    it('prefers Unipile Sales Navigator on auto without reporting a product', async () => {
      unipileSearchAccountResolver.resolve.mockResolvedValue({
        accountId: 'sn-acct',
        product: 'sales_navigator',
        via: 'workspace_sales_navigator',
      });

      await expect(
        resolver.resolve('jobs', { dataSource: 'auto' }),
      ).resolves.toEqual({
        dataSource: 'linkedin',
        accountId: 'sn-acct',
      });
    });

    it('falls back to harvest then errors when nothing is configured', async () => {
      unipileSearchAccountResolver.resolve.mockResolvedValue(null);
      harvestLinkedinService.isConfigured.mockReturnValue(true);

      await expect(resolver.resolve('jobs', {})).resolves.toEqual({
        dataSource: 'harvest',
      });

      harvestLinkedinService.isConfigured.mockReturnValue(false);

      await expect(resolver.resolve('jobs', {})).rejects.toBeInstanceOf(
        HttpException,
      );
    });
  });

  describe('posts', () => {
    it('resolves the pool account when pool is requested', async () => {
      unipileSearchAccountResolver.resolvePoolAccount.mockResolvedValue({
        accountId: 'pool-acct',
      });

      await expect(
        resolver.resolve('posts', { dataSource: 'linkedin_pool' }),
      ).resolves.toEqual({
        dataSource: 'linkedin_pool',
        accountId: 'pool-acct',
      });
    });

    it('errors instead of falling back to index when nothing is configured', async () => {
      unipileSearchAccountResolver.resolve.mockResolvedValue(null);

      await expect(
        resolver.resolve('posts', { dataSource: 'auto' }),
      ).rejects.toBeInstanceOf(HttpException);
    });
  });

  describe('companies', () => {
    it('reports the Unipile product on auto', async () => {
      unipileSearchAccountResolver.resolve.mockResolvedValue({
        accountId: 'sn-acct',
        product: 'sales_navigator',
        via: 'workspace_sales_navigator',
      });

      await expect(
        resolver.resolve('companies', { dataSource: 'auto' }),
      ).resolves.toEqual({
        dataSource: 'linkedin',
        accountId: 'sn-acct',
        unipileProduct: 'sales_navigator',
      });
      expect(harvestLinkedinService.isConfigured).not.toHaveBeenCalled();
    });

    it('uses recruiter when auto resolves a Recruiter account', async () => {
      unipileSearchAccountResolver.resolve.mockResolvedValue({
        accountId: 'rec-acct',
        product: 'recruiter',
        via: 'member',
      });

      await expect(
        resolver.resolve('companies', { apiToken: 'token' }),
      ).resolves.toEqual({
        dataSource: 'recruiter',
        accountId: 'rec-acct',
        unipileProduct: 'recruiter',
      });
    });

    it('falls back to harvest then index when Unipile is unavailable', async () => {
      unipileSearchAccountResolver.resolve.mockResolvedValue(null);
      harvestLinkedinService.isConfigured.mockReturnValue(true);

      await expect(
        resolver.resolve('companies', { dataSource: 'auto' }),
      ).resolves.toEqual({ dataSource: 'harvest' });

      harvestLinkedinService.isConfigured.mockReturnValue(false);

      await expect(
        resolver.resolve('companies', { dataSource: 'auto' }),
      ).resolves.toEqual({ dataSource: 'index' });
    });

    it('accepts accountless aliases without touching LinkedIn', async () => {
      for (const dataSource of ['index', 'harvest', 'bright_data'] as const) {
        await expect(
          resolver.resolve('companies', { dataSource }),
        ).resolves.toEqual({ dataSource });
      }

      expect(unipileSearchAccountResolver.resolve).not.toHaveBeenCalled();
    });

    it('reports the Sales Navigator product for an explicit pool account', async () => {
      unipileSearchAccountResolver.resolvePoolAccount.mockResolvedValue({
        accountId: 'pool-acct',
      });

      await expect(
        resolver.resolve('companies', { dataSource: 'linkedin_pool' }),
      ).resolves.toEqual({
        dataSource: 'linkedin_pool',
        accountId: 'pool-acct',
        unipileProduct: 'sales_navigator',
      });
    });
  });
});
