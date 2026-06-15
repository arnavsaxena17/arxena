import { Injectable, Logger } from '@nestjs/common';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

import type { SuperImposeHarvestQueryParams } from 'src/engine/core-modules/org-chart/types/super-impose.types';

type HarvestLeadItem = Record<string, unknown>;
type HarvestProfileResponse = Record<string, unknown>;
type HarvestPagination = {
  totalPages?: number;
  totalElements?: number;
  pageNumber?: number;
  pageSize?: number;
};

@Injectable()
export class HarvestLinkedinService {
  private readonly logger = new Logger(HarvestLinkedinService.name);
  private static readonly DEFAULT_BASE_URL = 'https://api.harvest-api.com';
  /** Harvest Starter plan concurrency; override with HARVEST_API_CONCURRENCY if the plan changes. */
  private static readonly DEFAULT_HARVEST_CONCURRENCY = 5;
  private static readonly MAX_HARVEST_CONCURRENCY = 40;

  constructor(private readonly environmentService: EnvironmentService) {}

  isConfigured(): boolean {
    const apiKey = this.getApiKey();
    return typeof apiKey === 'string' && apiKey.length > 0;
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
  }): Promise<{ current: HarvestLeadItem[]; pastWithProfiles: HarvestLeadItem[] }> {
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
      if (params.locations?.trim()) {
        searchParams.set('locations', params.locations.trim());
      }
      if (params.geoIds?.trim()) {
        searchParams.set('geoIds', params.geoIds.trim());
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
  ): Promise<{ items: HarvestLeadItem[]; pagination: HarvestPagination | null }> {
    const url = this.buildLeadSearchUrlFromParams(params);
    const json = await this.getJson(url);
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
      ...params,
      page: 1,
    });

    return pageResult.pagination?.totalElements ?? pageResult.items.length;
  }

  async fetchAllLeadsFromQueryParams(input: {
    params: Omit<SuperImposeHarvestQueryParams, 'page'>;
    maxProfiles?: number;
    onProgress?: (message: string) => void | Promise<void>;
  }): Promise<HarvestLeadItem[]> {
    const maxProfiles = Math.max(1, Math.min(2500, input.maxProfiles ?? 500));
    const maxPages = Math.max(1, Math.ceil(maxProfiles / 25));
    const firstPage = await this.fetchLeadSearchPageFromParams({
      ...input.params,
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
        ...input.params,
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
  }): Promise<{ items: HarvestLeadItem[]; pagination: HarvestPagination | null }> {
    const url = this.buildLeadSearchUrl(input.companyUrl, input.type, input.page);
    const json = await this.getJson(url);
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

    await Promise.all(
      Array.from({ length: concurrency }, () => runWorker()),
    );

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

    await Promise.all(
      Array.from({ length: concurrency }, () => runWorker()),
    );

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
      totalPages: readNumber('totalPages'),
      totalElements: readNumber('totalElements'),
      pageNumber: readNumber('pageNumber'),
      pageSize: readNumber('pageSize'),
    };
  }

  private async fetchProfile(
    linkedinUrl: string,
  ): Promise<HarvestProfileResponse | null> {
    const url = `${this.getBaseUrl()}/linkedin/profile?url=${encodeURIComponent(
      linkedinUrl,
    )}`;
    try {
      const json = await this.getJson(url);
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

  private async getJson(url: string): Promise<unknown> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('HARVEST_API_KEY is not configured');
    }
    const response = await fetch(url, {
      headers: {
        'X-API-Key': apiKey,
      },
    });
    if (!response.ok) {
      throw new Error(`Harvest request failed with status ${response.status}`);
    }
    return response.json();
  }
}
