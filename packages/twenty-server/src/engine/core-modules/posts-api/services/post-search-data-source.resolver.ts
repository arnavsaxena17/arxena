import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

import { HarvestLinkedinService } from 'src/engine/core-modules/org-chart/services/harvest-linkedin.service';
import { UnipileSearchAccountResolver } from 'src/engine/core-modules/linkedin-search/services/unipile-search-account.resolver';

import type {
  PostDataSourceAlias,
  PostResolvedDataSourceAlias,
} from '../constants/post-data-source-aliases';

export type ResolvePostSearchDataSourceInput = {
  dataSource?: PostDataSourceAlias;
  accountId?: string;
  apiToken?: string;
};

export type ResolvedPostSearchDataSource = {
  dataSource: PostResolvedDataSourceAlias;
  accountId?: string;
};

const isUnresolved = (dataSource?: PostDataSourceAlias): boolean =>
  !dataSource || dataSource === 'auto';

@Injectable()
export class PostSearchDataSourceResolver {
  private readonly logger = new Logger(PostSearchDataSourceResolver.name);

  constructor(
    private readonly unipileSearchAccountResolver: UnipileSearchAccountResolver,
    private readonly harvestLinkedinService: HarvestLinkedinService,
  ) {}

  async resolve(
    input: ResolvePostSearchDataSourceInput,
  ): Promise<ResolvedPostSearchDataSource> {
    if (!isUnresolved(input.dataSource)) {
      return this.resolveExplicit(input);
    }

    const unipile = await this.unipileSearchAccountResolver.resolve({
      accountId: input.accountId,
      apiToken: input.apiToken,
      preferPool: true,
    });

    if (unipile) {
      const dataSource: PostResolvedDataSourceAlias =
        unipile.via === 'pool'
          ? 'pool'
          : unipile.product === 'recruiter'
            ? 'recruiter'
            : 'unipile';

      this.logger.log(
        `Posts API dataSource auto using ${dataSource} account=${unipile.accountId}`,
      );

      return { dataSource, accountId: unipile.accountId };
    }

    if (this.harvestLinkedinService.isConfigured()) {
      this.logger.log('Posts API dataSource auto falling back to harvest');

      return { dataSource: 'harvest' };
    }

    throw new HttpException(
      'No LinkedIn Unipile account or Harvest configuration is available for post search',
      HttpStatus.BAD_REQUEST,
    );
  }

  private async resolveExplicit(
    input: ResolvePostSearchDataSourceInput,
  ): Promise<ResolvedPostSearchDataSource> {
    const dataSource = input.dataSource as PostResolvedDataSourceAlias;

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
