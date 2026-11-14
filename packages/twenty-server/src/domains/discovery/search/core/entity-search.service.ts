import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { getLinkedInUnipileSearchPageLimit } from 'twenty-shared';

import { BrightDataBusinessSearchService } from 'src/domains/discovery/providers/bright-data/services/bright-data-business-search.service';
import { BrightDataLudicrousSearchService } from 'src/domains/discovery/providers/bright-data/services/ludicrous/bright-data-ludicrous-search.service';
import { mapBrightDataCompanyToSearchHit } from 'src/domains/discovery/providers/bright-data/utils/bright-data-business-search.util';
import { LinkedInSearchService } from 'src/domains/discovery/transport/linkedin-search/services/linkedin-search.service';
import { UnipileSearchAccountResolver } from 'src/domains/discovery/transport/linkedin-search/services/unipile-search-account.resolver';
import type { LinkedInSearchResponse } from 'src/domains/discovery/transport/linkedin-search/types/linkedin-search-response.type';
import {
  classifyLinkedInSearchUrl,
  extractSalesNavigatorAccountListId,
} from 'src/domains/discovery/transport/linkedin-search/utils/classify-linkedin-search-url.util';
import { isUnipileAccountListV2Enabled } from 'src/domains/discovery/transport/linkedin-search/utils/sales-navigator-account-list-sort.util';
import type { UnipileLinkedinProduct } from 'src/domains/discovery/transport/linkedin-search/utils/unipile-linkedin-product.util';
import { CompaniesEsService } from 'src/domains/org-graph/org-chart/services/companies-es.service';
import { HarvestLinkedinService } from 'src/domains/org-graph/org-chart/services/harvest-linkedin.service';
import { LinkedinParameterResolver } from 'src/domains/discovery/transport/linkedin-search/utils/linkedin-parameter-resolver.util';

import {
  COMPANY_DATA_SOURCE_CATEGORIES,
  type CompanyDataSourceAlias,
} from '../company-api/constants/company-data-source-aliases';
import type { CompanySearchDto } from '../company-api/dto/company-search.dto';
import { CompanySearchHitTransformer } from '../company-api/services/company-search-hit.transformer';
import type {
  CompanyDataSourcesStatusResponse,
  CompanySearchHit,
  CompanySearchResponse,
} from '../company-api/company-api.types';
import { identityKeysForHit } from '../company-api/utils/company-identity.util';
import {
  JOB_DATA_SOURCE_CATEGORIES,
  type JobDataSourceAlias,
} from '../jobs-api/constants/job-data-source-aliases';
import type { JobSearchDto } from '../jobs-api/dto/job-search.dto';
import { JobSearchHitTransformer } from '../jobs-api/services/job-search-hit.transformer';
import type {
  JobDataSourcesStatusResponse,
  JobSearchResponse,
} from '../jobs-api/jobs-api.types';
import {
  POST_DATA_SOURCE_CATEGORIES,
  type PostDataSourceAlias,
} from '../posts-api/constants/post-data-source-aliases';
import type { PostSearchDto } from '../posts-api/dto/post-search.dto';
import { PostSearchHitTransformer } from '../posts-api/services/post-search-hit.transformer';
import type {
  PostDataSourcesStatusResponse,
  PostSearchResponse,
} from '../posts-api/posts-api.types';
import {
  EntitySearchDataSourceResolver,
  type ResolvedSearchDataSourceAlias,
} from './search-data-source';

export type SearchCompaniesOptions = {
  workspaceId?: string;
  isKnownHit?: (hit: CompanySearchHit) => boolean;
  stopAtKnown?: boolean;
};

const HARVEST_POSTED_LIMIT_BY_DATE_POSTED: Record<string, string> = {
  past_day: '24h',
  past_week: 'week',
  past_month: 'month',
};

const mapDatePostedToHarvestPostedLimit = (
  datePosted?: string,
): string | undefined => {
  if (!datePosted) {
    return undefined;
  }

  return HARVEST_POSTED_LIMIT_BY_DATE_POSTED[datePosted];
};

// One façade over the three list entities. Jobs, posts and companies used to be
// three near-identical resolver -> service -> controller stacks; the resolver,
// the status builder and the dispatch now live here, and each entity keeps only
// its own contract (DTO, response type, hit mapping, URL prefix).
@Injectable()
export class EntitySearchService {
  private readonly logger = new Logger(EntitySearchService.name);

  constructor(
    private readonly companiesEsService: CompaniesEsService,
    private readonly harvestLinkedinService: HarvestLinkedinService,
    private readonly linkedInSearchService: LinkedInSearchService,
    private readonly unipileSearchAccountResolver: UnipileSearchAccountResolver,
    private readonly dataSourceResolver: EntitySearchDataSourceResolver,
    private readonly jobSearchHitTransformer: JobSearchHitTransformer,
    private readonly postSearchHitTransformer: PostSearchHitTransformer,
    private readonly companySearchHitTransformer: CompanySearchHitTransformer,
    private readonly linkedinParameterResolver: LinkedinParameterResolver,
    private readonly brightDataBusinessSearchService: BrightDataBusinessSearchService,
    private readonly brightDataLudicrousSearchService: BrightDataLudicrousSearchService,
  ) {}

  private sourceAliases<TAlias extends string>(
    categories: ReadonlyArray<{
      alias: TAlias;
      label: string;
      description: string;
    }>,
    configuredByAlias: Record<TAlias, boolean>,
  ) {
    return categories.map((category) => ({
      alias: category.alias,
      label: category.label,
      description: category.description,
      configured: configuredByAlias[category.alias],
    }));
  }

  getJobDataSourcesStatus(): JobDataSourcesStatusResponse {
    const unipileConfigured =
      this.unipileSearchAccountResolver.isUnipileConfigured();
    const harvestConfigured = this.harvestLinkedinService.isConfigured();

    return {
      status: 'ok',
      sources: this.sourceAliases<JobDataSourceAlias>(
        JOB_DATA_SOURCE_CATEGORIES,
        {
          auto: unipileConfigured || harvestConfigured,
          harvest: harvestConfigured,
          linkedin: unipileConfigured,
          linkedin_pool: unipileConfigured,
          recruiter: unipileConfigured,
        },
      ),
    };
  }

  getPostDataSourcesStatus(): PostDataSourcesStatusResponse {
    const unipileConfigured =
      this.unipileSearchAccountResolver.isUnipileConfigured();
    const harvestConfigured = this.harvestLinkedinService.isConfigured();

    return {
      status: 'ok',
      sources: this.sourceAliases<PostDataSourceAlias>(
        POST_DATA_SOURCE_CATEGORIES,
        {
          auto: unipileConfigured || harvestConfigured,
          harvest: harvestConfigured,
          linkedin: unipileConfigured,
          linkedin_pool: unipileConfigured,
          recruiter: unipileConfigured,
        },
      ),
    };
  }

  getCompanyDataSourcesStatus(): CompanyDataSourcesStatusResponse {
    const unipileConfigured =
      this.unipileSearchAccountResolver.isUnipileConfigured();

    return {
      status: 'ok',
      sources: this.sourceAliases<CompanyDataSourceAlias>(
        COMPANY_DATA_SOURCE_CATEGORIES,
        {
          auto: unipileConfigured || this.harvestLinkedinService.isConfigured(),
          index: this.companiesEsService.isEnabled(),
          harvest: this.harvestLinkedinService.isConfigured(),
          linkedin: unipileConfigured,
          linkedin_pool: unipileConfigured,
          recruiter: unipileConfigured,
          bright_data: this.brightDataBusinessSearchService.isConfigured(),
        },
      ),
    };
  }

  async searchJobs(
    body: JobSearchDto,
    apiToken?: string,
  ): Promise<JobSearchResponse> {
    const resolved = await this.dataSourceResolver.resolve('jobs', {
      dataSource: body.dataSource,
      accountId: body.accountId,
      apiToken,
    });
    const limit = Math.max(1, Math.min(100, body.limit ?? 20));
    const keywords = body.keywords?.trim() || '';

    if (resolved.dataSource === 'harvest') {
      if (!this.harvestLinkedinService.isConfigured()) {
        throw new HttpException(
          'Harvest data source is not configured',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const result = await this.harvestLinkedinService.searchJobs({
        search: keywords,
        location: body.location,
        company: body.company,
        datePosted: body.datePosted,
        limit,
      });

      return {
        status: 'ok',
        dataSource: 'harvest',
        total: result.total,
        items: result.items.map((item) =>
          this.jobSearchHitTransformer.fromHarvestItem(item),
        ),
      };
    }

    if (!resolved.accountId) {
      throw new HttpException(
        'A LinkedIn Unipile account is required for this job search data source',
        HttpStatus.BAD_REQUEST,
      );
    }

    const response = await this.linkedInSearchService.searchJobs(
      {
        keywords: keywords || undefined,
        location: body.location?.trim() ? [body.location.trim()] : undefined,
        company: body.company?.trim() ? [body.company.trim()] : undefined,
        date_posted: body.datePosted,
      },
      resolved.accountId,
      { limit },
    );

    const items = response.items
      .filter((item) => item.type === 'JOB')
      .map((item) =>
        this.jobSearchHitTransformer.fromUnipileItem(
          item as unknown as Record<string, unknown>,
        ),
      );

    return {
      status: 'ok',
      dataSource: resolved.dataSource as Exclude<JobDataSourceAlias, 'auto'>,
      total: items.length,
      items,
    };
  }

  async searchPosts(
    body: PostSearchDto,
    apiToken?: string,
  ): Promise<PostSearchResponse> {
    const resolved = await this.dataSourceResolver.resolve('posts', {
      dataSource: body.dataSource,
      accountId: body.accountId,
      apiToken,
    });
    const limit = Math.max(1, Math.min(100, body.limit ?? 20));
    const keywords = body.keywords?.trim() || '';

    if (resolved.dataSource === 'harvest') {
      if (!this.harvestLinkedinService.isConfigured()) {
        throw new HttpException(
          'Harvest data source is not configured',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const result = await this.harvestLinkedinService.searchPosts({
        search: keywords,
        postedLimit: mapDatePostedToHarvestPostedLimit(body.datePosted),
        sortBy: body.sortBy,
        contentType: body.contentType,
        limit,
      });

      return {
        status: 'ok',
        dataSource: 'harvest',
        total: result.total,
        items: result.items.map((item) =>
          this.postSearchHitTransformer.fromHarvestItem(item),
        ),
      };
    }

    if (!resolved.accountId) {
      throw new HttpException(
        'A LinkedIn Unipile account is required for this post search data source',
        HttpStatus.BAD_REQUEST,
      );
    }

    const response = await this.linkedInSearchService.searchPosts(
      {
        keywords: keywords || undefined,
        sort_by: body.sortBy,
        date_posted: body.datePosted,
        content_type: body.contentType,
      },
      resolved.accountId,
      { limit },
    );

    const items = this.postSearchHitTransformer.fromUnipileItems(
      response.items as unknown as Array<
        { type?: string } & Record<string, unknown>
      >,
    );

    return {
      status: 'ok',
      dataSource: resolved.dataSource as Exclude<PostDataSourceAlias, 'auto'>,
      total: items.length,
      items,
    };
  }

  private async searchCompaniesFromBrightData(
    body: CompanySearchDto,
    options?: SearchCompaniesOptions,
  ): Promise<CompanySearchResponse> {
    const query = body.query?.trim() ?? '';

    if (!query) {
      throw new HttpException(
        'Bright Data company search requires query',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!this.brightDataBusinessSearchService.isConfigured()) {
      throw new HttpException(
        'Bright Data is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const requestedMode = body.mode ?? 'ludicrous';

    if (requestedMode === 'ludicrous' && options?.workspaceId) {
      const { summary, result } =
        await this.brightDataLudicrousSearchService.searchNaturalLanguage({
          workspaceId: options.workspaceId,
          projectId: 'company-api',
          entity: 'company',
          rawQuery: query,
          maxBudgetUsd: body.maxBudgetUsd ?? 1,
          targetCount: body.limit,
        });

      return {
        status: 'ok',
        dataSource: 'bright_data',
        total: summary.estimatedUniqueRecords,
        items: result.documents.map((document) =>
          mapBrightDataCompanyToSearchHit(document),
        ),
      };
    }

    // Ludicrous needs a workspace to bill, so anonymous callers get instant
    const result = await this.brightDataBusinessSearchService.search({
      entity: 'company',
      mode: requestedMode === 'ludicrous' ? 'instant' : requestedMode,
      query: query.slice(0, 200),
      limit: body.limit,
      offset: body.offset,
    });

    return {
      status: 'ok',
      dataSource: 'bright_data',
      total: result.matched,
      items: result.documents.map((document) =>
        mapBrightDataCompanyToSearchHit(document),
      ),
    };
  }

  async searchCompanies(
    body: CompanySearchDto,
    apiToken?: string,
    options?: SearchCompaniesOptions,
  ): Promise<CompanySearchResponse> {
    const resolved = await this.dataSourceResolver.resolve('companies', {
      dataSource: body.dataSource,
      accountId: body.accountId,
      apiToken,
    });

    if (resolved.dataSource === 'bright_data') {
      return this.searchCompaniesFromBrightData(body, options);
    }

    const limit = Math.max(1, Math.min(100, body.limit ?? 20));
    const searchUrl = this.resolveLinkedInSearchUrl(body);
    const keywords =
      body.keywords?.trim() ||
      body.companyName?.trim() ||
      (searchUrl ? '' : body.query?.trim()) ||
      '';

    if (
      searchUrl &&
      (resolved.dataSource === 'index' || resolved.dataSource === 'harvest')
    ) {
      throw new HttpException(
        'LinkedIn search URLs require a connected Unipile LinkedIn account (dataSource auto, unipile, pool, or recruiter)',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (resolved.dataSource === 'index') {
      const result = await this.companiesEsService.searchCompanies({
        query: body.query,
        companyName: body.companyName,
        website: body.website,
        industry: body.industry,
        country: body.country,
        region: body.region,
        locality: body.locality,
        employeeSize: body.size,
        limit,
        offset: body.offset,
      });

      return {
        status: 'ok',
        dataSource: 'index',
        total: result.total,
        items: this.takeUniqueHits({
          hits: result.items.map((item) =>
            this.companySearchHitTransformer.fromIndexItem(item),
          ),
          limit,
          isKnownHit: options?.isKnownHit,
          stopAtKnown: false,
        }).items,
      };
    }

    if (resolved.dataSource === 'harvest') {
      if (!this.harvestLinkedinService.isConfigured()) {
        throw new HttpException(
          'Harvest data source is not configured',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const result = await this.harvestLinkedinService.searchCompanies({
        search: keywords || body.website,
        location: body.location,
        limit,
      });

      return {
        status: 'ok',
        dataSource: 'harvest',
        total: result.total,
        items: this.takeUniqueHits({
          hits: result.items.map((item) =>
            this.companySearchHitTransformer.fromHarvestItem(item),
          ),
          limit,
          isKnownHit: options?.isKnownHit,
          stopAtKnown: false,
        }).items,
      };
    }

    if (!resolved.accountId) {
      throw new HttpException(
        'A LinkedIn Unipile account is required for this company search data source',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (searchUrl) {
      const paged = await this.searchUnipileCompaniesFromUrl({
        url: searchUrl,
        accountId: resolved.accountId,
        limit,
        product: resolved.unipileProduct ?? 'sales_navigator',
        useV2: body.useV2,
        lastViewedAt: body.lastViewedAt,
        isKnownHit: options?.isKnownHit,
        stopAtKnown:
          options?.stopAtKnown ??
          Boolean(
            extractSalesNavigatorAccountListId(searchUrl) &&
            isUnipileAccountListV2Enabled(body.useV2) &&
            options?.isKnownHit,
          ),
      });

      return {
        status: 'ok',
        dataSource: resolved.dataSource as Exclude<
          CompanyDataSourceAlias,
          'auto'
        >,
        unipileProduct: resolved.unipileProduct,
        total: paged.total,
        items: paged.items,
      };
    }

    const paged = await this.searchUnipileCompanies({
      keywords: keywords || body.website || body.industry || '',
      location: body.location,
      industry: body.industry,
      accountId: resolved.accountId,
      product: resolved.unipileProduct ?? 'sales_navigator',
      limit,
      isKnownHit: options?.isKnownHit,
      stopAtKnown: options?.stopAtKnown ?? false,
    });

    return {
      status: 'ok',
      dataSource: resolved.dataSource as Exclude<
        CompanyDataSourceAlias,
        'auto'
      >,
      unipileProduct: resolved.unipileProduct,
      total: paged.total,
      items: paged.items,
    };
  }

  private resolveLinkedInSearchUrl(body: CompanySearchDto): string | undefined {
    const explicit = body.url?.trim();
    if (explicit) {
      return explicit;
    }

    const query = body.query?.trim();
    if (query && /linkedin\.com/i.test(query)) {
      return query;
    }

    return undefined;
  }

  private async searchUnipileCompaniesFromUrl(input: {
    url: string;
    accountId: string;
    limit: number;
    product: UnipileLinkedinProduct;
    useV2?: boolean;
    lastViewedAt?: number;
    isKnownHit?: (hit: CompanySearchHit) => boolean;
    stopAtKnown?: boolean;
  }): Promise<{
    items: CompanySearchHit[];
    total: number;
  }> {
    const accountListId = extractSalesNavigatorAccountListId(input.url);
    if (accountListId) {
      if (isUnipileAccountListV2Enabled(input.useV2)) {
        return this.collectUnipileCompanyPages({
          limit: input.limit,
          product: input.product,
          pagination: 'offset',
          isKnownHit: input.isKnownHit,
          stopAtKnown: input.stopAtKnown ?? false,
          fetchPage: ({ offset, limit }) =>
            this.linkedInSearchService.browseSalesAccountList(
              accountListId,
              input.accountId,
              { limit, offset },
            ),
        });
      }

      return this.collectUnipileCompanyPages({
        limit: input.limit,
        product: input.product,
        pagination: 'cursor',
        isKnownHit: input.isKnownHit,
        stopAtKnown: false,
        fetchPage: ({ cursor, limit }) =>
          cursor
            ? this.linkedInSearchService.searchWithCursor(
                cursor,
                input.accountId,
                { limit },
              )
            : this.linkedInSearchService.searchCompaniesSalesNavigator(
                {
                  account_lists: { include: [accountListId] },
                  ...(typeof input.lastViewedAt === 'number'
                    ? { last_viewed_at: input.lastViewedAt }
                    : {}),
                },
                input.accountId,
                { limit },
              ),
      });
    }

    const classified = classifyLinkedInSearchUrl(input.url);
    if (!classified) {
      throw new HttpException(
        'url must be a LinkedIn Sales Navigator account list URL (/sales/accounts/dashboard?listId=...), a company search URL, or a people search URL',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.collectUnipileCompanyPages({
      limit: input.limit,
      product: input.product,
      pagination: 'cursor',
      isKnownHit: input.isKnownHit,
      stopAtKnown: false,
      fetchPage: ({ cursor, limit }) =>
        cursor
          ? this.linkedInSearchService.searchWithCursor(
              cursor,
              input.accountId,
              { limit },
            )
          : this.linkedInSearchService.searchFromUrl(
              classified.url,
              input.accountId,
              { limit },
            ),
    });
  }

  private async searchUnipileCompanies(input: {
    keywords: string;
    location?: string;
    industry?: string;
    accountId: string;
    product: UnipileLinkedinProduct;
    limit: number;
    isKnownHit?: (hit: CompanySearchHit) => boolean;
    stopAtKnown?: boolean;
  }): Promise<{
    items: CompanySearchHit[];
    total: number;
  }> {
    const locationId = await this.resolveParameterId(
      'location',
      input.location,
      input.accountId,
    );
    const industryId = await this.resolveParameterId(
      'industry',
      input.industry,
      input.accountId,
    );
    const location = locationId ? [locationId] : undefined;
    const industry = industryId ? [industryId] : undefined;

    if (input.product === 'recruiter') {
      return this.collectUnipileCompanyPages({
        limit: input.limit,
        product: input.product,
        pagination: 'cursor',
        isKnownHit: input.isKnownHit,
        stopAtKnown: input.stopAtKnown ?? false,
        fetchPage: ({ cursor, limit }) =>
          cursor
            ? this.linkedInSearchService.searchWithCursor(
                cursor,
                input.accountId,
                { limit },
              )
            : this.linkedInSearchService.searchCompaniesRecruiter(
                { keywords: input.keywords || undefined, location, industry },
                input.accountId,
                { limit },
              ),
      });
    }

    if (input.product === 'classic') {
      return this.collectUnipileCompanyPages({
        limit: input.limit,
        product: input.product,
        pagination: 'cursor',
        isKnownHit: input.isKnownHit,
        stopAtKnown: input.stopAtKnown ?? false,
        fetchPage: ({ cursor, limit }) =>
          cursor
            ? this.linkedInSearchService.searchWithCursor(
                cursor,
                input.accountId,
                { limit },
              )
            : this.linkedInSearchService.searchCompanies(
                { keywords: input.keywords || undefined, location, industry },
                input.accountId,
                { limit },
              ),
      });
    }

    try {
      return await this.collectUnipileCompanyPages({
        limit: input.limit,
        product: input.product,
        pagination: 'cursor',
        isKnownHit: input.isKnownHit,
        stopAtKnown: input.stopAtKnown ?? false,
        fetchPage: ({ cursor, limit }) =>
          cursor
            ? this.linkedInSearchService.searchWithCursor(
                cursor,
                input.accountId,
                { limit },
              )
            : this.linkedInSearchService.searchCompaniesSalesNavigator(
                {
                  keywords: input.keywords || undefined,
                  ...(locationId
                    ? { location: { include: [locationId] } }
                    : {}),
                  ...(industryId
                    ? { industry: { include: [industryId] } }
                    : {}),
                },
                input.accountId,
                { limit },
              ),
      });
    } catch (error) {
      this.logger.warn(
        `Sales Nav company search failed, falling back to classic: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return this.collectUnipileCompanyPages({
        limit: input.limit,
        product: 'classic',
        pagination: 'cursor',
        isKnownHit: input.isKnownHit,
        stopAtKnown: input.stopAtKnown ?? false,
        fetchPage: ({ cursor, limit }) =>
          cursor
            ? this.linkedInSearchService.searchWithCursor(
                cursor,
                input.accountId,
                { limit },
              )
            : this.linkedInSearchService.searchCompanies(
                { keywords: input.keywords || undefined, location, industry },
                input.accountId,
                { limit },
              ),
      });
    }
  }

  private async collectUnipileCompanyPages(input: {
    limit: number;
    product: UnipileLinkedinProduct;
    pagination: 'cursor' | 'offset';
    isKnownHit?: (hit: CompanySearchHit) => boolean;
    stopAtKnown?: boolean;
    fetchPage: (options: {
      cursor?: string;
      offset?: number;
      limit: number;
    }) => Promise<LinkedInSearchResponse>;
  }): Promise<{
    items: CompanySearchHit[];
    total: number;
  }> {
    const productPageSize = getLinkedInUnipileSearchPageLimit(
      input.product === 'recruiter' ? 'classic' : input.product,
    );
    const pageLimit = Math.min(input.limit, productPageSize);
    const collected: CompanySearchHit[] = [];
    const seenKeys = new Set<string>();
    let cursor: string | undefined;
    let offset = 0;
    let firstPaging: LinkedInSearchResponse['paging'] | undefined;
    const maxPages = 20;

    for (
      let page = 0;
      page < maxPages && collected.length < input.limit;
      page += 1
    ) {
      const response = await input.fetchPage({
        cursor,
        offset,
        limit: pageLimit,
      });
      const rawItems = (response.items ?? []) as unknown as Array<
        { type?: string } & Record<string, unknown>
      >;

      if (page === 0) {
        firstPaging = response.paging;
      }

      if (rawItems.length === 0) {
        break;
      }

      const pageHits =
        this.companySearchHitTransformer.fromUnipileItems(rawItems);
      const accepted = this.appendUniqueHits({
        hits: pageHits,
        collected,
        seenKeys,
        remaining: input.limit - collected.length,
        isKnownHit: input.isKnownHit,
        stopAtKnown: input.stopAtKnown,
      });

      collected.push(...accepted.items);

      if (accepted.stoppedAtKnown || collected.length >= input.limit) {
        break;
      }

      if (input.pagination === 'offset') {
        offset += rawItems.length;
        const totalCount = response.paging?.total_count;
        if (
          rawItems.length < pageLimit ||
          (typeof totalCount === 'number' && offset >= totalCount)
        ) {
          break;
        }
        continue;
      }

      const nextCursor = response.cursor?.trim();
      if (!nextCursor) {
        break;
      }
      cursor = nextCursor;
    }

    const total =
      typeof firstPaging?.total_count === 'number' &&
      firstPaging.total_count > 0
        ? firstPaging.total_count
        : collected.length;

    return { items: collected, total };
  }

  private takeUniqueHits(input: {
    hits: CompanySearchHit[];
    limit: number;
    isKnownHit?: (hit: CompanySearchHit) => boolean;
    stopAtKnown?: boolean;
  }): { items: CompanySearchHit[]; stoppedAtKnown: boolean } {
    return this.appendUniqueHits({
      hits: input.hits,
      collected: [],
      seenKeys: new Set<string>(),
      remaining: input.limit,
      isKnownHit: input.isKnownHit,
      stopAtKnown: input.stopAtKnown,
    });
  }

  private appendUniqueHits(input: {
    hits: CompanySearchHit[];
    collected: CompanySearchHit[];
    seenKeys: Set<string>;
    remaining: number;
    isKnownHit?: (hit: CompanySearchHit) => boolean;
    stopAtKnown?: boolean;
  }): { items: CompanySearchHit[]; stoppedAtKnown: boolean } {
    const items: CompanySearchHit[] = [];

    for (const hit of input.hits) {
      if (items.length >= input.remaining) {
        break;
      }

      const keys = identityKeysForHit(hit);
      const isDuplicate = keys.some((key) => input.seenKeys.has(key));
      const isKnown = input.isKnownHit?.(hit) === true;

      if (isKnown && input.stopAtKnown) {
        this.logger.log(
          `Stopping company search at already-known company ${hit.name || hit.id}`,
        );

        return { items, stoppedAtKnown: true };
      }

      if (isKnown || isDuplicate || keys.length === 0) {
        continue;
      }

      for (const key of keys) {
        input.seenKeys.add(key);
      }
      items.push(hit);
    }

    return { items, stoppedAtKnown: false };
  }

  private async resolveParameterId(
    kind: 'location' | 'industry',
    value: string | undefined,
    accountId: string,
  ): Promise<string | undefined> {
    const trimmed = value?.trim();
    if (!trimmed) {
      return undefined;
    }

    if (kind === 'location') {
      const resolved = await this.linkedinParameterResolver.resolveLocationName(
        trimmed,
        accountId,
      );

      return resolved?.id ?? trimmed;
    }

    const resolved = (await this.linkedinParameterResolver.resolveParameterIds(
      { industry: { include: [trimmed] } },
      accountId,
      'company-api',
    )) as { industry?: { include?: string[] } };

    return resolved.industry?.include?.[0]?.trim() || trimmed;
  }
}

export type { ResolvedSearchDataSourceAlias };
