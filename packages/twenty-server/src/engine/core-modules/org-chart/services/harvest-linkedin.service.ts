import { Injectable, Logger, Optional } from '@nestjs/common';
import { isNonEmptyString } from '@sniptt/guards';
import { companyIdentityKey } from 'twenty-shared/arx';

import {
  ProviderCallLogService,
  trackProviderCall,
} from 'src/engine/core-modules/provider-call-log/services/provider-call-log.service';
import { ProviderQueryCacheService } from 'src/engine/core-modules/cache-storage/services/provider-query-cache.service';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

import type { SuperImposeHarvestQueryParams } from 'src/engine/core-modules/org-chart/types/super-impose.types';
import {
  getHarvestNextPage,
  HARVEST_SEARCH_MAX_PAGE,
  HARVEST_SEARCH_MAX_RECORDS_PER_CALL,
  HARVEST_SEARCH_PATHS,
  type HarvestSearchKind,
} from 'src/engine/core-modules/org-chart/utils/harvest-search-params.util';
import { isHarvestCompanyNameMatch } from 'src/engine/core-modules/org-chart/utils/harvest-company-name-match.util';
import { pickHarvestGeoMatch } from 'src/engine/core-modules/org-chart/utils/harvest-geo-match.util';

// v2 keys a company search by the company's identity, so two spellings of one
// employer cost one Harvest page instead of two.
const HARVEST_SEARCH_CACHE_PREFIX = 'harvest-search:v2';
const HARVEST_SALES_NAV_CACHE_PREFIX = 'harvest-sales-nav:v1';
const HARVEST_GEO_CACHE_PREFIX = 'harvest-geo:v1';
// One lead-search page is billed, and a normal sweep asks for page 1 twice:
// once to size the batch and once to fetch it.
const HARVEST_LEAD_PAGE_CACHE_PREFIX = 'harvest-lead-page:v1';
const HARVEST_PROFILE_CACHE_PREFIX = 'harvest-profile:v1';
const HARVEST_COMPANY_SEARCH_PATH = '/linkedin/company-search';

type HarvestLeadItem = Record<string, unknown>;
type HarvestProfileResponse = Record<string, unknown>;
type HarvestPagination = {
  totalPages?: number;
  totalElements?: number;
  pageNumber?: number;
  pageSize?: number;
};

// The ledger prices Harvest by endpoint, so the path decides the operation
const harvestOperationForUrl = (url: string): string => {
  const path = url.split('?')[0];

  if (path.endsWith('/linkedin/lead-search')) {
    return 'lead-search';
  }

  if (path.endsWith('/linkedin/company-search')) {
    return 'company-search';
  }

  if (path.endsWith('/linkedin/profile')) {
    return 'profile';
  }

  if (path.endsWith('/linkedin/company')) {
    return 'company';
  }

  return 'lookup';
};

@Injectable()
export class HarvestLinkedinService {
  private readonly logger = new Logger(HarvestLinkedinService.name);
  private static readonly DEFAULT_BASE_URL = 'https://api.harvest-api.com';
  /** Harvest Starter plan concurrency; override with HARVEST_API_CONCURRENCY if the plan changes. */
  private static readonly DEFAULT_HARVEST_CONCURRENCY = 5;
  private static readonly MAX_HARVEST_CONCURRENCY = 40;

  constructor(
    private readonly environmentService: EnvironmentService,
    @Optional()
    private readonly providerQueryCache?: ProviderQueryCacheService,
    @Optional()
    private readonly providerCallLog?: ProviderCallLogService,
  ) {}

  isConfigured(): boolean {
    const apiKey = this.getApiKey();
    return typeof apiKey === 'string' && apiKey.length > 0;
  }

  async searchCompanies(input: {
    search?: string;
    location?: string;
    limit?: number;
  }): Promise<{
    total: number;
    pageSize: number;
    totalPages: number;
    items: HarvestLeadItem[];
  }> {
    return this.searchPaginatedCollection({
      path: '/linkedin/company-search',
      search: input.search,
      location: input.location,
      limit: input.limit,
    });
  }

  // A location id, unlike a location string, has no comma to be mistaken for
  // another location: Harvest reads `locations` as a comma-separated list, so
  // "Mumbai, Maharashtra, India" is sent as three locations and the country
  // swallows the filter. The wider metro node is also preferred, because it is
  // the more inclusive of the two and is what LinkedIn itself suggests for a
  // bare city name.
  async resolveGeoIds(location: string): Promise<string[]> {
    const trimmed = location.trim();
    if (!trimmed) {
      return [];
    }

    const run = async () => {
      const json = await this.getJson(
        `${this.getBaseUrl()}/linkedin/geo-id-search?search=${encodeURIComponent(
          trimmed,
        )}`,
      );
      const match = pickHarvestGeoMatch(
        (json as Record<string, unknown> | null)?.elements,
        trimmed,
      );

      this.logger.log(
        `Harvest geo "${trimmed}" matched=${match.matchedVia} geoIds=${match.geoIds.join(',') || 'none'} titles="${match.titles.join(' | ')}"`,
      );

      return match.geoIds;
    };

    try {
      if (!this.providerQueryCache) {
        return await run();
      }

      return await this.providerQueryCache.getOrFetch(
        HARVEST_GEO_CACHE_PREFIX,
        { location: trimmed },
        run,
      );
    } catch (error) {
      // No id means the caller keeps sending the location text, which Harvest
      // validates itself, so a lookup failure narrows nothing silently
      this.logger.warn(
        `Harvest geo lookup failed for "${trimmed}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return [];
    }
  }

  // Sales Navigator lead or account search from `page` on, until `limit`
  // records or the last page. Records are billed, so `limit` is capped.
  async searchSalesNavigatorCollection(input: {
    kind: HarvestSearchKind;
    query: Record<string, string>;
    page?: number;
    limit?: number;
  }): Promise<{
    items: HarvestLeadItem[];
    firstPage: number;
    lastPage: number;
    nextPage: number | null;
    totalElements?: number;
    totalPages?: number;
  }> {
    const limit = Math.max(
      1,
      Math.min(HARVEST_SEARCH_MAX_RECORDS_PER_CALL, input.limit ?? 25),
    );
    const firstPage = Math.max(
      1,
      Math.min(HARVEST_SEARCH_MAX_PAGE, Math.floor(input.page ?? 1)),
    );
    const run = () =>
      this.searchSalesNavigatorCollectionUncached({
        ...input,
        limit,
        page: firstPage,
      });

    if (!this.providerQueryCache) {
      return run();
    }

    return this.providerQueryCache.getOrFetch(
      HARVEST_SALES_NAV_CACHE_PREFIX,
      {
        kind: input.kind,
        query: input.query,
        page: firstPage,
        limit,
      },
      run,
    );
  }

  private async searchSalesNavigatorCollectionUncached(input: {
    kind: HarvestSearchKind;
    query: Record<string, string>;
    page: number;
    limit: number;
  }): Promise<{
    items: HarvestLeadItem[];
    firstPage: number;
    lastPage: number;
    nextPage: number | null;
    totalElements?: number;
    totalPages?: number;
  }> {
    const { limit, page: firstPage } = input;
    const items: HarvestLeadItem[] = [];
    let page = firstPage;
    let lastPage = firstPage;
    let nextPage: number | null = firstPage;
    let pagination: HarvestPagination | null = null;

    while (nextPage !== null && items.length < limit) {
      page = nextPage;
      const searchParams = new URLSearchParams({
        ...input.query,
        page: String(page),
      });
      const json = await this.getJson(
        `${this.getBaseUrl()}${HARVEST_SEARCH_PATHS[input.kind]}?${searchParams.toString()}`,
      );
      const pageItems = this.extractLeadItems(json);
      pagination = this.extractPagination(json) ?? pagination;
      items.push(...pageItems);
      lastPage = page;
      nextPage = getHarvestNextPage(
        page,
        pagination?.totalPages,
        pageItems.length,
      );
    }

    this.logger.log(
      `Harvest ${input.kind} search pages=${firstPage}-${lastPage} rows=${items.length} total=${pagination?.totalElements ?? 'unknown'}`,
    );

    // Rows past `limit` on the last page were already fetched; keep them
    // rather than pay for them again on the next call
    return {
      items,
      firstPage,
      lastPage,
      nextPage,
      totalElements: pagination?.totalElements,
      totalPages: pagination?.totalPages,
    };
  }

  // The LinkedIn URL of the company Harvest's keyword search ranks first,
  // only when its name matches; Harvest filters employers by URL or id
  async findCompanyLinkedinUrl(
    companyName: string,
  ): Promise<{ name: string; linkedinUrl: string } | null> {
    const trimmed = companyName.trim();
    if (!trimmed) {
      return null;
    }

    const result = await this.searchCompanies({ search: trimmed, limit: 5 });
    const match = result.items.find((item) =>
      isHarvestCompanyNameMatch(trimmed, String(item.name ?? '')),
    );
    const rawUrl = match?.linkedinUrl ?? match?.url;
    const linkedinUrl = typeof rawUrl === 'string' ? rawUrl.trim() : '';

    return match && linkedinUrl
      ? { name: String(match.name), linkedinUrl }
      : null;
  }

  async searchJobs(input: {
    search?: string;
    location?: string;
    company?: string;
    datePosted?: number;
    limit?: number;
  }): Promise<{ total: number; items: HarvestLeadItem[] }> {
    return this.searchPaginatedCollection({
      path: '/linkedin/job-search',
      search: input.search,
      location: input.location,
      company: input.company,
      datePosted: input.datePosted,
      limit: input.limit,
    });
  }

  async searchPosts(input: {
    search?: string;
    postedLimit?: string;
    sortBy?: string;
    contentType?: string;
    limit?: number;
  }): Promise<{ total: number; items: HarvestLeadItem[] }> {
    return this.searchPaginatedCollection({
      path: '/linkedin/post-search',
      search: input.search,
      postedLimit: input.postedLimit,
      sortBy: input.sortBy,
      contentType: input.contentType,
      limit: input.limit,
    });
  }

  async fetchCurrentAndPastEmployees(input: {
    linkedinCompanyUrl: string;
    maxProfiles?: number;
    /**
     * When true (client sets `includeOrgIntelligence`, e.g. Org intelligence button), also
     * fetch past-company leads and run `/linkedin/profile` enrichment for each past lead.
     * Default false: current employees only — full `maxProfiles` budget for current.
     */
    includePastEmployees?: boolean;
    onProgress?: (message: string) => void | Promise<void>;
  }): Promise<{
    current: HarvestLeadItem[];
    pastWithProfiles: HarvestLeadItem[];
  }> {
    const normalizedCompanyUrl = input.linkedinCompanyUrl.trim();
    const maxProfiles = Math.max(1, Math.min(1000, input.maxProfiles ?? 250));
    const includePastEmployees = input.includePastEmployees === true;
    const maxCurrent = includePastEmployees
      ? Math.max(1, Math.floor(maxProfiles / 2))
      : maxProfiles;

    await input.onProgress?.('Harvest: fetching current employees...');
    const current = await this.fetchLeads({
      companyUrl: normalizedCompanyUrl,
      type: 'current',
      maxProfiles: maxCurrent,
    });

    let past: HarvestLeadItem[] = [];
    if (includePastEmployees) {
      const maxPast = Math.max(1, Math.floor(maxProfiles / 2));
      await input.onProgress?.('Harvest: fetching past employees...');
      past = await this.fetchLeads({
        companyUrl: normalizedCompanyUrl,
        type: 'past',
        maxProfiles: maxPast,
      });
      this.logger.log(
        `Harvest company employee fetch done companyUrl="${normalizedCompanyUrl}" currentLeadRows=${current.length} pastLeadRows=${past.length} (past enriched next)`,
      );
    } else {
      this.logger.log(
        `Harvest company employee fetch done companyUrl="${normalizedCompanyUrl}" currentLeadRows=${current.length} pastLeadRows=0 (past skipped — enable includeOrgIntelligence for past + profile enrichment)`,
      );
    }

    const pastWithProfiles =
      past.length > 0
        ? await this.enrichLeadsWithProfilesInParallel({
            leads: past,
            onProgress: async (completedCount, total) => {
              if (completedCount % 10 === 0 || completedCount === total) {
                await input.onProgress?.(
                  `Harvest: enriched ${completedCount}/${total} past profiles...`,
                );
              }
            },
          })
        : [];

    this.logger.log(
      `Harvest company employee fetch finished companyUrl="${normalizedCompanyUrl}" current=${current.length} pastWithProfiles=${pastWithProfiles.length}`,
    );

    return { current, pastWithProfiles };
  }

  buildLeadSearchUrlFromParams(params: SuperImposeHarvestQueryParams): string {
    const searchParams = new URLSearchParams();
    searchParams.set('page', String(params.page));

    if (params.salesNavUrl?.trim()) {
      searchParams.set('salesNavUrl', params.salesNavUrl.trim());
    } else {
      if (params.currentCompanies?.trim()) {
        searchParams.set('currentCompanies', params.currentCompanies.trim());
      }
      if (params.search?.trim()) {
        searchParams.set('search', params.search.trim());
      }
      if (params.geoIds?.trim()) {
        searchParams.set('geoIds', params.geoIds.trim());
      } else if (params.locations?.trim()) {
        // `locations` is a comma-separated list, so a compound name is read as
        // several places and the widest one wins. A resolved id replaces it.
        searchParams.set('locations', params.locations.trim());
      }
      if (params.functionIds?.trim()) {
        searchParams.set('functionIds', params.functionIds.trim());
      }
    }

    if (params.sessionId?.trim()) {
      searchParams.set('sessionId', params.sessionId.trim());
    }

    return `${this.getBaseUrl()}/linkedin/lead-search?${searchParams.toString()}`;
  }

  async fetchLeadSearchPageFromParams(
    params: SuperImposeHarvestQueryParams,
  ): Promise<{
    items: HarvestLeadItem[];
    pagination: HarvestPagination | null;
  }> {
    const url = this.buildLeadSearchUrlFromParams(params);
    const json = await this.getCachedJson(HARVEST_LEAD_PAGE_CACHE_PREFIX, url);
    const items = this.extractLeadItems(json);

    this.logger.log(
      `Harvest lead-search page=${params.page} parsedRows=${items.length} ${this.describeLeadSearchPayloadForLog(json)}`,
    );

    return {
      items,
      pagination: this.extractPagination(json),
    };
  }

  async estimateLeadSearchTotalElements(
    params: Omit<SuperImposeHarvestQueryParams, 'page'>,
  ): Promise<number> {
    const pageResult = await this.fetchLeadSearchPageFromParams({
      ...(await this.withResolvedGeoIds(params)),
      page: 1,
    });

    return pageResult.pagination?.totalElements ?? pageResult.items.length;
  }

  // A caller that already has an id keeps it; otherwise the location text is
  // resolved once, so a compound name is not re-expanded into a wider list
  private async withResolvedGeoIds(
    params: Omit<SuperImposeHarvestQueryParams, 'page'>,
  ): Promise<Omit<SuperImposeHarvestQueryParams, 'page'>> {
    if (params.geoIds?.trim() || !params.locations?.trim()) {
      return params;
    }

    const geoIds = await this.resolveGeoIds(params.locations);

    return geoIds.length > 0 ? { ...params, geoIds: geoIds.join(',') } : params;
  }

  async fetchAllLeadsFromQueryParams(input: {
    params: Omit<SuperImposeHarvestQueryParams, 'page'>;
    maxProfiles?: number;
    onProgress?: (message: string) => void | Promise<void>;
  }): Promise<HarvestLeadItem[]> {
    const maxProfiles = Math.max(1, Math.min(2500, input.maxProfiles ?? 500));
    const maxPages = Math.max(1, Math.ceil(maxProfiles / 25));
    const params = await this.withResolvedGeoIds(input.params);
    const firstPage = await this.fetchLeadSearchPageFromParams({
      ...params,
      page: 1,
    });
    const out = [...firstPage.items];

    if (out.length >= maxProfiles) {
      return out.slice(0, maxProfiles);
    }

    const totalPages = firstPage.pagination?.totalPages;
    if (totalPages === 1) {
      return out;
    }

    const lastPage =
      typeof totalPages === 'number'
        ? Math.min(maxPages, totalPages, 100)
        : maxPages;

    for (let page = 2; page <= lastPage; page += 1) {
      await input.onProgress?.(`Harvest: fetching page ${page}/${lastPage}...`);
      const pageResult = await this.fetchLeadSearchPageFromParams({
        ...params,
        page,
      });
      out.push(...pageResult.items);
      if (out.length >= maxProfiles) {
        return out.slice(0, maxProfiles);
      }
      if (pageResult.items.length === 0) {
        break;
      }
    }

    return out;
  }

  private async fetchLeads(input: {
    companyUrl: string;
    type: 'current' | 'past';
    maxProfiles: number;
  }): Promise<HarvestLeadItem[]> {
    const maxPages = Math.max(1, Math.ceil(input.maxProfiles / 25));
    const firstPage = await this.fetchLeadSearchPage({
      companyUrl: input.companyUrl,
      type: input.type,
      page: 1,
    });
    const out = [...firstPage.items];

    if (out.length >= input.maxProfiles) {
      return out.slice(0, input.maxProfiles);
    }

    const totalPages = firstPage.pagination?.totalPages;
    if (totalPages === 1) {
      return out;
    }

    if (typeof totalPages === 'number' && totalPages > 1) {
      const lastPage = Math.min(maxPages, totalPages);
      const pages = Array.from(
        { length: lastPage - 1 },
        (_, index) => index + 2,
      );
      const pageItems = await this.fetchLeadSearchPagesInParallel({
        companyUrl: input.companyUrl,
        type: input.type,
        pages,
      });

      for (const page of pages) {
        const items = pageItems.get(page) ?? [];
        if (items.length === 0) {
          continue;
        }
        out.push(...items);
        if (out.length >= input.maxProfiles) {
          return out.slice(0, input.maxProfiles);
        }
      }

      return out;
    }

    return this.fetchLeadSearchPagesSequentially({
      companyUrl: input.companyUrl,
      type: input.type,
      startPage: 2,
      maxPages,
      out,
      maxProfiles: input.maxProfiles,
    });
  }

  private async fetchLeadSearchPage(input: {
    companyUrl: string;
    type: 'current' | 'past';
    page: number;
  }): Promise<{
    items: HarvestLeadItem[];
    pagination: HarvestPagination | null;
  }> {
    const url = this.buildLeadSearchUrl(
      input.companyUrl,
      input.type,
      input.page,
    );
    const json = await this.getCachedJson(HARVEST_LEAD_PAGE_CACHE_PREFIX, url);
    const items = this.extractLeadItems(json);
    this.logger.log(
      `Harvest lead-search type=${input.type} page=${input.page} companyUrl="${input.companyUrl}" parsedRows=${items.length} ${this.describeLeadSearchPayloadForLog(json)}`,
    );

    return {
      items,
      pagination: this.extractPagination(json),
    };
  }

  private async fetchLeadSearchPagesInParallel(input: {
    companyUrl: string;
    type: 'current' | 'past';
    pages: number[];
  }): Promise<Map<number, HarvestLeadItem[]>> {
    if (input.pages.length === 0) {
      return new Map();
    }

    const concurrency = Math.min(
      this.getHarvestConcurrency(),
      input.pages.length,
    );
    const results = new Map<number, HarvestLeadItem[]>();
    let nextIndex = 0;

    this.logger.log(
      `Harvest lead-search type=${input.type} parallel pages=${input.pages[0]}-${input.pages[input.pages.length - 1]} concurrency=${concurrency} companyUrl="${input.companyUrl}"`,
    );

    const runWorker = async () => {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;

        if (index >= input.pages.length) {
          break;
        }

        const page = input.pages[index];
        const pageResult = await this.fetchLeadSearchPage({
          companyUrl: input.companyUrl,
          type: input.type,
          page,
        });
        results.set(page, pageResult.items);
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => runWorker()));

    return results;
  }

  private async fetchLeadSearchPagesSequentially(input: {
    companyUrl: string;
    type: 'current' | 'past';
    startPage: number;
    maxPages: number;
    out: HarvestLeadItem[];
    maxProfiles: number;
  }): Promise<HarvestLeadItem[]> {
    const out = [...input.out];

    for (let page = input.startPage; page <= input.maxPages; page += 1) {
      const pageResult = await this.fetchLeadSearchPage({
        companyUrl: input.companyUrl,
        type: input.type,
        page,
      });

      if (pageResult.items.length === 0) {
        break;
      }

      out.push(...pageResult.items);
      if (out.length >= input.maxProfiles) {
        return out.slice(0, input.maxProfiles);
      }
    }

    return out;
  }

  private buildLeadSearchUrl(
    companyUrl: string,
    type: 'current' | 'past',
    page: number,
  ): string {
    const query =
      type === 'current'
        ? `currentCompanies=${encodeURIComponent(companyUrl)}`
        : `pastCompanies=${encodeURIComponent(companyUrl)}`;

    return `${this.getBaseUrl()}/linkedin/lead-search?${query}&page=${page}`;
  }

  private async enrichLeadsWithProfilesInParallel(input: {
    leads: HarvestLeadItem[];
    onProgress?: (
      completedCount: number,
      total: number,
    ) => void | Promise<void>;
  }): Promise<HarvestLeadItem[]> {
    const total = input.leads.length;
    const results = new Array<HarvestLeadItem>(total);
    const concurrency = Math.min(this.getHarvestConcurrency(), total);
    let nextIndex = 0;
    let completedCount = 0;

    this.logger.log(
      `Harvest profile enrichment parallel total=${total} concurrency=${concurrency}`,
    );

    const runWorker = async () => {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;

        if (index >= total) {
          break;
        }

        const lead = input.leads[index];
        const linkedinUrl = this.extractLinkedinUrl(lead);

        if (!linkedinUrl) {
          results[index] = lead;
        } else {
          const profile = await this.fetchProfile(linkedinUrl);
          results[index] = {
            ...lead,
            ...(profile ? { org_harvest_profile: profile } : {}),
          };
        }

        completedCount += 1;
        await input.onProgress?.(completedCount, total);
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => runWorker()));

    return results;
  }

  private getHarvestConcurrency(): number {
    const raw = Number(
      process.env.HARVEST_API_CONCURRENCY ??
        HarvestLinkedinService.DEFAULT_HARVEST_CONCURRENCY,
    );
    const parsed = Number.isFinite(raw)
      ? raw
      : HarvestLinkedinService.DEFAULT_HARVEST_CONCURRENCY;

    return Math.max(
      1,
      Math.min(HarvestLinkedinService.MAX_HARVEST_CONCURRENCY, parsed),
    );
  }

  private extractPagination(payload: unknown): HarvestPagination | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const pagination = (payload as Record<string, unknown>).pagination;
    if (!pagination || typeof pagination !== 'object') {
      return null;
    }

    const paginationObject = pagination as Record<string, unknown>;
    const readNumber = (key: string): number | undefined => {
      const value = paginationObject[key];
      return typeof value === 'number' && Number.isFinite(value)
        ? value
        : undefined;
    };

    return {
      totalPages: readNumber('totalPages') ?? readNumber('totalPages'),
      totalElements: readNumber('totalElements') ?? readNumber('totalElements'),
      pageNumber: readNumber('pageNumber') ?? readNumber('pageNumber'),
      pageSize: readNumber('pageSize') ?? readNumber('pageSize'),
    };
  }

  // One full profile by public LinkedIn URL; null when Harvest has none
  async fetchProfileByUrl(
    linkedinUrl: string,
  ): Promise<HarvestProfileResponse | null> {
    return this.fetchProfile(linkedinUrl);
  }

  private async fetchProfile(
    linkedinUrl: string,
  ): Promise<HarvestProfileResponse | null> {
    const url = `${this.getBaseUrl()}/linkedin/profile?url=${encodeURIComponent(
      linkedinUrl,
    )}`;
    try {
      const json = await this.getCachedJson(HARVEST_PROFILE_CACHE_PREFIX, url);
      if (!json || typeof json !== 'object') {
        return null;
      }
      // Harvest /linkedin/profile returns `{ element: Profile, status, error, query }`.
      // Downstream consumers expect a Profile-shaped object, so unwrap `element`
      // when present (and tolerate the rare unwrapped shape used in tests).
      const wrapper = json as Record<string, unknown>;
      const inner = wrapper.element;
      if (inner && typeof inner === 'object') {
        return inner as HarvestProfileResponse;
      }
      return wrapper as HarvestProfileResponse;
    } catch (error) {
      this.logger.warn(
        `Harvest profile fetch failed for ${linkedinUrl}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private async searchPaginatedCollection(input: {
    path: string;
    search?: string;
    location?: string;
    company?: string;
    datePosted?: number;
    postedLimit?: string;
    sortBy?: string;
    contentType?: string;
    limit?: number;
  }): Promise<{
    total: number;
    pageSize: number;
    totalPages: number;
    items: HarvestLeadItem[];
  }> {
    const limit = Math.max(1, Math.min(100, input.limit ?? 20));
    const run = () =>
      this.searchPaginatedCollectionUncached({ ...input, limit });

    if (!this.providerQueryCache) {
      return run();
    }

    const parts = { ...input, limit };
    // On the company-search path the query is the company name; on every other
    // path `search` carries titles and words that must not be rewritten.
    const keyParts = {
      ...parts,
      ...(isNonEmptyString(input.company) && {
        company: companyIdentityKey(input.company),
      }),
      ...(input.path === HARVEST_COMPANY_SEARCH_PATH &&
        isNonEmptyString(input.search) && {
          search: companyIdentityKey(input.search),
        }),
    };

    return this.providerQueryCache.getOrFetch(
      HARVEST_SEARCH_CACHE_PREFIX,
      parts,
      run,
      { keyParts },
    );
  }

  private async searchPaginatedCollectionUncached(input: {
    path: string;
    search?: string;
    location?: string;
    company?: string;
    datePosted?: number;
    postedLimit?: string;
    sortBy?: string;
    contentType?: string;
    limit: number;
  }): Promise<{
    total: number;
    pageSize: number;
    totalPages: number;
    items: HarvestLeadItem[];
  }> {
    const { limit } = input;
    const firstPage = await this.fetchCollectionPage({
      ...input,
      page: 1,
    });
    const out = [...firstPage.items];
    const total = firstPage.pagination?.totalElements ?? out.length;
    const pageSize =
      firstPage.pagination?.pageSize && firstPage.pagination.pageSize > 0
        ? firstPage.pagination.pageSize
        : out.length || limit;
    const totalPages =
      firstPage.pagination?.totalPages && firstPage.pagination.totalPages > 0
        ? firstPage.pagination.totalPages
        : total === 0
          ? 0
          : Math.ceil(total / Math.max(pageSize, 1));

    const toResult = (items: HarvestLeadItem[]) => ({
      total,
      pageSize,
      totalPages,
      items: items.slice(0, limit),
    });

    if (out.length >= limit) {
      return toResult(out);
    }

    const lastPage =
      typeof firstPage.pagination?.totalPages === 'number'
        ? Math.min(firstPage.pagination.totalPages, 10)
        : Math.ceil(limit / Math.max(out.length, 1));

    for (let page = 2; page <= lastPage; page += 1) {
      const pageResult = await this.fetchCollectionPage({
        ...input,
        page,
      });
      out.push(...pageResult.items);
      if (out.length >= limit || pageResult.items.length === 0) {
        break;
      }
    }

    return toResult(out);
  }

  private async fetchCollectionPage(input: {
    path: string;
    search?: string;
    location?: string;
    company?: string;
    datePosted?: number;
    postedLimit?: string;
    sortBy?: string;
    contentType?: string;
    page: number;
  }): Promise<{
    items: HarvestLeadItem[];
    pagination: HarvestPagination | null;
  }> {
    const searchParams = new URLSearchParams();
    searchParams.set('page', String(input.page));
    if (input.search?.trim()) {
      searchParams.set('search', input.search.trim());
    }
    if (input.location?.trim()) {
      searchParams.set('location', input.location.trim());
    }
    if (input.company?.trim()) {
      searchParams.set('company', input.company.trim());
    }
    if (input.postedLimit?.trim()) {
      searchParams.set('postedLimit', input.postedLimit.trim());
    } else if (
      typeof input.datePosted === 'number' &&
      Number.isFinite(input.datePosted)
    ) {
      searchParams.set('postedLimit', String(input.datePosted));
    }
    if (input.sortBy?.trim()) {
      searchParams.set('sortBy', input.sortBy.trim());
    }
    if (input.contentType?.trim()) {
      searchParams.set('contentType', input.contentType.trim());
    }

    const url = `${this.getBaseUrl()}${input.path}?${searchParams.toString()}`;
    const json = await this.getJson(url);

    return {
      items: this.extractLeadItems(json),
      pagination: this.extractPagination(json),
    };
  }

  private extractLeadItems(payload: unknown): HarvestLeadItem[] {
    if (!payload || typeof payload !== 'object') {
      return [];
    }
    if (Array.isArray(payload)) {
      return payload.filter(
        (row): row is HarvestLeadItem => !!row && typeof row === 'object',
      );
    }
    const objectPayload = payload as Record<string, unknown>;
    const candidates = [
      objectPayload.elements,
      objectPayload.items,
      objectPayload.results,
      objectPayload.data,
      objectPayload.people,
      objectPayload.companies,
      objectPayload.jobs,
      objectPayload.posts,
    ];

    for (const value of candidates) {
      if (Array.isArray(value)) {
        return value.filter(
          (row): row is HarvestLeadItem => !!row && typeof row === 'object',
        );
      }
    }

    this.logger.warn(
      `Harvest lead-search JSON had no known lead array (elements/items/results/data/people). ${this.describeLeadSearchPayloadForLog(payload)}`,
    );

    return [];
  }

  /** Debug helper: no profile rows, only shapes and Harvest status fields. */
  private describeLeadSearchPayloadForLog(payload: unknown): string {
    if (payload === null) {
      return 'payload=null';
    }
    if (Array.isArray(payload)) {
      return `payload=array length=${payload.length}`;
    }
    if (typeof payload !== 'object') {
      return `payloadType=${typeof payload}`;
    }
    const o = payload as Record<string, unknown>;
    const keys = Object.keys(o).sort().join(',');
    const arrayLen = (k: string): string => {
      const v = o[k];
      return Array.isArray(v) ? String(v.length) : '—';
    };
    const status =
      typeof o.status === 'string' ? o.status : JSON.stringify(o.status);
    const error =
      typeof o.error === 'string' ? o.error : JSON.stringify(o.error);
    return `topLevelKeys=[${keys}] elementsLen=${arrayLen('elements')} itemsLen=${arrayLen('items')} resultsLen=${arrayLen('results')} status=${status} error=${error}`;
  }

  private extractLinkedinUrl(lead: HarvestLeadItem): string | undefined {
    const candidates = [
      lead.linkedinUrl,
      lead.linkedin_url,
      lead.profileUrl,
      lead.profile_url,
      lead.url,
    ];
    for (const value of candidates) {
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
    return undefined;
  }

  private getApiKey(): string | undefined {
    const envValue = this.environmentService.get('HARVEST_API_KEY');
    return typeof envValue === 'string' && envValue.trim().length > 0
      ? envValue.trim()
      : undefined;
  }

  private getBaseUrl(): string {
    const envValue = this.environmentService.get('HARVEST_API_BASE_URL');
    return typeof envValue === 'string' && envValue.trim().length > 0
      ? envValue.trim().replace(/\/+$/, '')
      : HarvestLinkedinService.DEFAULT_BASE_URL;
  }

  // The URL is the whole request, so it is also the cache key: a page or a
  // profile that was already paid for is not paid for again on a rerun, and a
  // concurrent identical request coalesces onto one call.
  private async getCachedJson(prefix: string, url: string): Promise<unknown> {
    if (!this.providerQueryCache) {
      return this.getJson(url);
    }

    return this.providerQueryCache.getOrFetch(prefix, { url }, () =>
      this.getJson(url),
    );
  }

  private async getJson(url: string): Promise<unknown> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('HARVEST_API_KEY is not configured');
    }
    // One ledger row per request, named by endpoint: the catalog prices a
    // lead-search page differently from a profile fetch
    return trackProviderCall(
      this.providerCallLog,
      {
        provider: 'harvest',
        operation: harvestOperationForUrl(url),
        storeResponse: false,
      },
      async () => {
        const response = await fetch(url, {
          headers: {
            'X-API-Key': apiKey,
          },
        });
        if (!response.ok) {
          // Harvest explains a 400 (bad filter value) in the body
          const detail = await response.text().catch(() => '');
          throw new Error(
            `Harvest request failed with status ${response.status}${
              detail ? `: ${detail.slice(0, 300)}` : ''
            }`,
          );
        }
        return response.json();
      },
    );
  }
}
