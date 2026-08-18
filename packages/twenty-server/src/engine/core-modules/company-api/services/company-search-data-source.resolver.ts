import { Injectable, Logger } from '@nestjs/common';

import { HarvestLinkedinService } from 'src/engine/core-modules/org-chart/services/harvest-linkedin.service';
import { UnipileSearchAccountResolver } from 'src/engine/core-modules/linkedin-search/services/unipile-search-account.resolver';
import type { UnipileLinkedinProduct } from 'src/engine/core-modules/linkedin-search/utils/unipile-linkedin-product.util';

import type {
  CompanyDataSourceAlias,
  CompanyResolvedDataSourceAlias,
} from '../constants/company-data-source-aliases';

export type ResolveCompanySearchDataSourceInput = {
  dataSource?: CompanyDataSourceAlias;
  accountId?: string;
  apiToken?: string;
};

export type ResolvedCompanySearchDataSource = {
  dataSource: CompanyResolvedDataSourceAlias;
  accountId?: string;
  unipileProduct?: UnipileLinkedinProduct;
};

const isUnresolved = (dataSource?: CompanyDataSourceAlias): boolean =>
  !dataSource || dataSource === 'auto';

@Injectable()
export class CompanySearchDataSourceResolver {
  private readonly logger = new Logger(CompanySearchDataSourceResolver.name);

  constructor(
    private readonly unipileSearchAccountResolver: UnipileSearchAccountResolver,
    private readonly harvestLinkedinService: HarvestLinkedinService,
  ) {}

  async resolve(
    input: ResolveCompanySearchDataSourceInput,
  ): Promise<ResolvedCompanySearchDataSource> {
    if (!isUnresolved(input.dataSource)) {
      return this.resolveExplicit(input);
    }

    const unipile = await this.unipileSearchAccountResolver.resolve({
      accountId: input.accountId,
      apiToken: input.apiToken,
      preferPool: true,
    });

    if (unipile) {
      const dataSource: CompanyResolvedDataSourceAlias =
        unipile.via === 'pool'
          ? 'pool'
          : unipile.product === 'recruiter'
            ? 'recruiter'
            : 'unipile';

      this.logger.log(
        `Company API dataSource auto using ${dataSource} account=${unipile.accountId} product=${unipile.product}`,
      );

      return {
        dataSource,
        accountId: unipile.accountId,
        unipileProduct: unipile.product,
      };
    }

    if (this.harvestLinkedinService.isConfigured()) {
      this.logger.log('Company API dataSource auto falling back to harvest');

      return { dataSource: 'harvest' };
    }

    this.logger.log('Company API dataSource auto falling back to index');

    return { dataSource: 'index' };
  }

  private async resolveExplicit(
    input: ResolveCompanySearchDataSourceInput,
  ): Promise<ResolvedCompanySearchDataSource> {
    const dataSource = input.dataSource as CompanyResolvedDataSourceAlias;

    if (dataSource === 'index' || dataSource === 'harvest') {
      return { dataSource };
    }

    if (dataSource === 'pool') {
      const pool = await this.unipileSearchAccountResolver.resolvePoolAccount();
      if (!pool) {
        return { dataSource: 'pool' };
      }

      return {
        dataSource: 'pool',
        accountId: pool.accountId,
        unipileProduct: 'sales_navigator',
      };
    }

    const unipile = await this.unipileSearchAccountResolver.resolve({
      accountId: input.accountId,
      apiToken: input.apiToken,
      preferPool: dataSource !== 'recruiter',
    });

    if (!unipile) {
      return { dataSource };
    }

    const product =
      dataSource === 'recruiter' ? 'recruiter' : unipile.product;

    return {
      dataSource,
      accountId: unipile.accountId,
      unipileProduct: product,
    };
  }
}
