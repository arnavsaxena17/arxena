import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

import { HarvestLinkedinService } from 'src/engine/core-modules/org-chart/services/harvest-linkedin.service';
import { UnipileSearchAccountResolver } from 'src/engine/core-modules/linkedin-search/services/unipile-search-account.resolver';

import type {
  JobDataSourceAlias,
  JobResolvedDataSourceAlias,
} from '../constants/job-data-source-aliases';

export type ResolveJobSearchDataSourceInput = {
  dataSource?: JobDataSourceAlias;
  accountId?: string;
  apiToken?: string;
};

export type ResolvedJobSearchDataSource = {
  dataSource: JobResolvedDataSourceAlias;
  accountId?: string;
};

const isUnresolved = (dataSource?: JobDataSourceAlias): boolean =>
  !dataSource || dataSource === 'auto';

@Injectable()
export class JobSearchDataSourceResolver {
  private readonly logger = new Logger(JobSearchDataSourceResolver.name);

  constructor(
    private readonly unipileSearchAccountResolver: UnipileSearchAccountResolver,
    private readonly harvestLinkedinService: HarvestLinkedinService,
  ) {}

  async resolve(
    input: ResolveJobSearchDataSourceInput,
  ): Promise<ResolvedJobSearchDataSource> {
    if (!isUnresolved(input.dataSource)) {
      return this.resolveExplicit(input);
    }

    const unipile = await this.unipileSearchAccountResolver.resolve({
      accountId: input.accountId,
      apiToken: input.apiToken,
      preferPool: true,
    });

    if (unipile) {
      const dataSource: JobResolvedDataSourceAlias =
        unipile.via === 'pool'
          ? 'pool'
          : unipile.product === 'recruiter'
            ? 'recruiter'
            : 'unipile';

      this.logger.log(
        `Jobs API dataSource auto using ${dataSource} account=${unipile.accountId}`,
      );

      return { dataSource, accountId: unipile.accountId };
    }

    if (this.harvestLinkedinService.isConfigured()) {
      this.logger.log('Jobs API dataSource auto falling back to harvest');

      return { dataSource: 'harvest' };
    }

    throw new HttpException(
      'No LinkedIn Unipile account or Harvest configuration is available for job search',
      HttpStatus.BAD_REQUEST,
    );
  }

  private async resolveExplicit(
    input: ResolveJobSearchDataSourceInput,
  ): Promise<ResolvedJobSearchDataSource> {
    const dataSource = input.dataSource as JobResolvedDataSourceAlias;

    if (dataSource === 'harvest') {
      return { dataSource: 'harvest' };
    }

    if (dataSource === 'pool') {
      const pool = await this.unipileSearchAccountResolver.resolvePoolAccount();

      return { dataSource: 'pool', accountId: pool?.accountId };
    }

    const unipile = await this.unipileSearchAccountResolver.resolve({
      accountId: input.accountId,
      apiToken: input.apiToken,
      preferPool: false,
    });

    return { dataSource, accountId: unipile?.accountId };
  }
}
