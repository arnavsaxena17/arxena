import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { getLinkedInUnipileSearchPageLimit } from 'twenty-shared';

import { LinkedinParameterResolver } from 'src/engine/core-modules/candidate-search/utils/linkedin-parameter-resolver.util';
import { LinkedInSearchService } from 'src/engine/core-modules/linkedin-search/services/linkedin-search.service';
import type { LinkedInSearchResponse } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-response.type';
import { UnipileSearchAccountResolver } from 'src/engine/core-modules/linkedin-search/services/unipile-search-account.resolver';
import type { UnipileLinkedinProduct } from 'src/engine/core-modules/linkedin-search/utils/unipile-linkedin-product.util';
import {
  classifyLinkedInSearchUrl,
  extractSalesNavigatorAccountListId,
} from 'src/engine/core-modules/linkedin-search/utils/classify-linkedin-search-url.util';
import { isUnipileAccountListV2Enabled } from 'src/engine/core-modules/linkedin-search/utils/sales-navigator-account-list-sort.util';
import { CompaniesEsService } from 'src/engine/core-modules/org-chart/services/companies-es.service';
import { HarvestLinkedinService } from 'src/engine/core-modules/org-chart/services/harvest-linkedin.service';

import {
  COMPANY_DATA_SOURCE_CATEGORIES,
  type CompanyDataSourceAlias,
} from './constants/company-data-source-aliases';
import type { CompanySearchDto } from './dto/company-search.dto';
import type {
  CompanyDataSourcesStatusResponse,
  CompanySearchHit,
  CompanySearchResponse,
} from './company-api.types';
import { CompanySearchDataSourceResolver } from './services/company-search-data-source.resolver';
import { CompanySearchHitTransformer } from './services/company-search-hit.transformer';
import { identityKeysForHit } from './utils/company-identity.util';

export type SearchCompaniesOptions = {
  isKnownHit?: (hit: CompanySearchHit) => boolean;
  stopAtKnown?: boolean;
};

@Injectable()
export class CompanyApiService {
  private readonly logger = new Logger(CompanyApiService.name);

  constructor(
    private readonly companiesEsService: CompaniesEsService,
    private readonly harvestLinkedinService: HarvestLinkedinService,
    private readonly linkedInSearchService: LinkedInSearchService,
    private readonly unipileSearchAccountResolver: UnipileSearchAccountResolver,
    private readonly companySearchDataSourceResolver: CompanySearchDataSourceResolver,
    private readonly companySearchHitTransformer: CompanySearchHitTransformer,
    private readonly linkedinParameterResolver: LinkedinParameterResolver,
  ) {}

  getDataSourcesStatus(): CompanyDataSourcesStatusResponse {
    const unipileConfigured =
      this.unipileSearchAccountResolver.isUnipileConfigured();
    const configuredByAlias: Record<CompanyDataSourceAlias, boolean> = {
      auto: unipileConfigured || this.harvestLinkedinService.isConfigured(),
      index: this.companiesEsService.isEnabled(),
      harvest: this.harvestLinkedinService.isConfigured(),
      unipile: unipileConfigured,
      pool: unipileConfigured,
      recruiter: unipileConfigured,
    };

    return {
      status: 'ok',
      sources: COMPANY_DATA_SOURCE_CATEGORIES.map((category) => ({
        alias: category.alias,
        label: category.label,
        description: category.description,
        configured: configuredByAlias[category.alias],
      })),
    };
  }

  async searchCompanies(
    body: CompanySearchDto,
    apiToken?: string,
    options?: SearchCompaniesOptions,
  ): Promise<CompanySearchResponse> {
    const resolved = await this.companySearchDataSourceResolver.resolve({
      dataSource: body.dataSource,
      accountId: body.accountId,
      apiToken,
    });
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
        limit,
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
        dataSource: resolved.dataSource,
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
      dataSource: resolved.dataSource,
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
                  ...(locationId ? { location: { include: [locationId] } } : {}),
                  ...(industryId ? { industry: { include: [industryId] } } : {}),
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
      const rawItems = (response.items ?? []) as Array<
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
      typeof firstPaging?.total_count === 'number' && firstPaging.total_count > 0
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

