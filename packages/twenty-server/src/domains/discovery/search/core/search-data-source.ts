import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

import { UnipileSearchAccountResolver } from 'src/domains/discovery/transport/linkedin-search/services/unipile-search-account.resolver';
import type { UnipileLinkedinProduct } from 'src/domains/discovery/transport/linkedin-search/utils/unipile-linkedin-product.util';
import { HarvestLinkedinService } from 'src/domains/org-graph/org-chart/services/harvest-linkedin.service';

// Entity search shares one data-source vocabulary. The three list entities
// (companies, jobs, posts) previously each carried their own copy of this
// resolver; they differ only in which aliases need no LinkedIn account, what
// auto falls back to, and whether the Unipile product is reported back.
export type SearchEntity = 'companies' | 'jobs' | 'posts';

export type SearchDataSourceAlias =
  | 'auto'
  | 'index'
  | 'harvest'
  | 'linkedin'
  | 'linkedin_pool'
  | 'recruiter'
  | 'bright_data';

export type ResolvedSearchDataSourceAlias = Exclude<
  SearchDataSourceAlias,
  'auto'
>;

export type ResolvedSearchDataSource = {
  dataSource: ResolvedSearchDataSourceAlias;
  accountId?: string;
  unipileProduct?: UnipileLinkedinProduct;
};

export type ResolveSearchDataSourceInput = {
  dataSource?: SearchDataSourceAlias | string;
  accountId?: string;
  apiToken?: string;
};

type EntitySearchPolicy = {
  // Human label used in the "nothing configured" error.
  label: string;
  // Label used in log lines.
  logLabel: string;
  // What auto does when neither Unipile nor Harvest is available.
  autoFallback: 'harvest' | 'index' | null;
  // Whether the resolved Unipile product is reported to the caller.
  exposeUnipileProduct: boolean;
  // Product implied by an explicit `linkedin_pool` request, when any.
  poolAccountProduct?: UnipileLinkedinProduct;
  // Companies resolve pool accounts for every non-recruiter alias; jobs and
  // posts only ever use a pool account when explicitly asked for one.
  preferPoolForExplicit: boolean;
  // Companies accept index/harvest/bright_data without a LinkedIn account.
  allowAccountlessExplicit: boolean;
};

const POLICIES: Record<SearchEntity, EntitySearchPolicy> = {
  jobs: {
    label: 'job search',
    logLabel: 'Jobs API',
    autoFallback: null,
    exposeUnipileProduct: false,
    preferPoolForExplicit: false,
    allowAccountlessExplicit: false,
  },
  posts: {
    label: 'post search',
    logLabel: 'Posts API',
    autoFallback: null,
    exposeUnipileProduct: false,
    preferPoolForExplicit: false,
    allowAccountlessExplicit: false,
  },
  companies: {
    label: 'company search',
    logLabel: 'Company API',
    autoFallback: 'index',
    exposeUnipileProduct: true,
    poolAccountProduct: 'sales_navigator',
    preferPoolForExplicit: true,
    allowAccountlessExplicit: true,
  },
};

const isUnresolved = (dataSource?: string): boolean =>
  !dataSource || dataSource === 'auto';

@Injectable()
export class EntitySearchDataSourceResolver {
  private readonly logger = new Logger(EntitySearchDataSourceResolver.name);

  constructor(
    private readonly unipileSearchAccountResolver: UnipileSearchAccountResolver,
    private readonly harvestLinkedinService: HarvestLinkedinService,
  ) {}

  async resolve(
    entity: SearchEntity,
    input: ResolveSearchDataSourceInput,
  ): Promise<ResolvedSearchDataSource> {
    const policy = POLICIES[entity];

    return isUnresolved(input.dataSource)
      ? this.resolveAuto(policy, input)
      : this.resolveExplicit(policy, input);
  }

  private async resolveAuto(
    policy: EntitySearchPolicy,
    input: ResolveSearchDataSourceInput,
  ): Promise<ResolvedSearchDataSource> {
    const unipile = await this.unipileSearchAccountResolver.resolve({
      accountId: input.accountId,
      apiToken: input.apiToken,
      preferPool: true,
    });

    if (unipile) {
      const dataSource: ResolvedSearchDataSourceAlias =
        unipile.via === 'pool'
          ? 'linkedin_pool'
          : unipile.product === 'recruiter'
            ? 'recruiter'
            : 'linkedin';

      this.logger.log(
        `${policy.logLabel} dataSource auto using ${dataSource} account=${unipile.accountId}`,
      );

      return {
        dataSource,
        accountId: unipile.accountId,
        ...(policy.exposeUnipileProduct
          ? { unipileProduct: unipile.product }
          : {}),
      };
    }

    if (this.harvestLinkedinService.isConfigured()) {
      this.logger.log(
        `${policy.logLabel} dataSource auto falling back to harvest`,
      );

      return { dataSource: 'harvest' };
    }

    if (policy.autoFallback === 'index') {
      this.logger.log(
        `${policy.logLabel} dataSource auto falling back to index`,
      );

      return { dataSource: 'index' };
    }

    throw new HttpException(
      `No LinkedIn Unipile account or Harvest configuration is available for ${policy.label}`,
      HttpStatus.BAD_REQUEST,
    );
  }

  private async resolveExplicit(
    policy: EntitySearchPolicy,
    input: ResolveSearchDataSourceInput,
  ): Promise<ResolvedSearchDataSource> {
    const dataSource = input.dataSource as ResolvedSearchDataSourceAlias;

    if (
      policy.allowAccountlessExplicit &&
      (dataSource === 'index' ||
        dataSource === 'harvest' ||
        dataSource === 'bright_data')
    ) {
      return { dataSource };
    }

    if (dataSource === 'harvest') {
      return { dataSource: 'harvest' };
    }

    if (dataSource === 'linkedin_pool') {
      const pool = await this.unipileSearchAccountResolver.resolvePoolAccount();

      if (!pool) {
        return { dataSource: 'linkedin_pool' };
      }

      return {
        dataSource: 'linkedin_pool',
        accountId: pool.accountId,
        ...(policy.poolAccountProduct
          ? { unipileProduct: policy.poolAccountProduct }
          : {}),
      };
    }

    const unipile = await this.unipileSearchAccountResolver.resolve({
      accountId: input.accountId,
      apiToken: input.apiToken,
      preferPool: policy.preferPoolForExplicit
        ? dataSource !== 'recruiter'
        : false,
    });

    if (!unipile) {
      return { dataSource };
    }

    const product = dataSource === 'recruiter' ? 'recruiter' : unipile.product;

    return {
      dataSource,
      accountId: unipile.accountId,
      ...(policy.exposeUnipileProduct ? { unipileProduct: product } : {}),
    };
  }
}
