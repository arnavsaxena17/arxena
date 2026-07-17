import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

import { createHash } from 'crypto';

import axios, { AxiosInstance, isAxiosError } from 'axios';

import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

const APOLLO_API_BASE = 'https://api.apollo.io/api/v1';
const RAPID_API_APOLLO_SEARCH_BASE =
  'https://apollo-io-no-cookies-required.p.rapidapi.com';

/** Apollo People API Search (POST /mixed_people/api_search) — non-credit; master API key. */
export type ApolloPeopleSearchParams = {
  q_keywords?: string;
  person_titles?: string[];
  include_similar_titles?: boolean;
  person_locations?: string[];
  organization_locations?: string[];
  organization_ids?: string[];
  q_organization_domains_list?: string[];
  person_seniorities?: string[];
  page?: number;
  per_page?: number;
};

/** Apollo organization_id values are 24-char hex MongoDB-like ObjectIds (e.g. `5e66b6381e05b4008c8331b8`). */
export const APOLLO_ORGANIZATION_ID_REGEX = /^[a-f0-9]{24}$/i;

export const isApolloOrganizationId = (value: string | undefined): boolean =>
  typeof value === 'string' && APOLLO_ORGANIZATION_ID_REGEX.test(value.trim());

/** Extract the linkedin slug (e.g. "litify") from a linkedin company URL. */
const extractLinkedinCompanySlug = (
  linkedinUrl?: string,
): string | undefined => {
  if (!linkedinUrl?.trim()) return undefined;
  const match = linkedinUrl.match(/linkedin\.com\/company\/([^/?#]+)/i);

  if (!match?.[1]) return undefined;

  return decodeURIComponent(match[1].replace(/\/$/, '')).toLowerCase();
};

/** Apollo Organization Search (POST /mixed_companies/search) — consumes credits. */
export type ApolloOrganizationSearchParams = {
  q_organization_name?: string;
  q_organization_domains_list?: string[];
  organization_locations?: string[];
  /** Employee count ranges, formatted "min,max" (e.g. "200,2000"). */
  organization_num_employees_ranges?: string[];
  /** Industry / keyword tags to filter organizations by. */
  q_organization_keyword_tags?: string[];
  page?: number;
  per_page?: number;
};

/** Serialize bracket-array query params for Apollo REST. */
function appendApolloParams(
  params: URLSearchParams,
  key: string,
  values: string[] | undefined,
) {
  if (!values?.length) return;
  for (const v of values) {
    if (v.trim()) {
      params.append(`${key}[]`, v.trim());
    }
  }
}

type ApolloResolvedOrganization = {
  organizationId?: string;
  organizationName?: string;
  linkedinUrl?: string;
  primaryDomain?: string;
};

type OrgSearchCacheEntry = {
  expiresAt: number;
  data: Record<string, unknown>;
};

type OrgResolutionCacheEntry = {
  expiresAt: number;
  /** Null means a cached miss (no matching org). */
  resolved: ApolloResolvedOrganization | null;
};

@Injectable()
export class ApolloIoRestService {
  private readonly logger = new Logger(ApolloIoRestService.name);
  private readonly client: AxiosInstance;
  private readonly orgSearchResponseCache = new Map<
    string,
    OrgSearchCacheEntry
  >();
  private readonly orgResolutionCache = new Map<
    string,
    OrgResolutionCacheEntry
  >();

  private static readonly MAX_ORG_SEARCH_CACHE_ENTRIES = 2500;
  private static readonly MAX_ORG_RESOLUTION_CACHE_ENTRIES = 2500;

  constructor(
    private readonly environmentService: EnvironmentService,
    @InjectCacheStorage(CacheStorageNamespace.EngineCandidateSearch)
    private readonly engineCandidateSearchCache: CacheStorageService,
  ) {
    this.client = axios.create({
      baseURL: APOLLO_API_BASE,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      timeout: 120_000,
    });
  }

  private getApiKey(): string | null {
    const key = this.environmentService.get('APOLLO_API_KEY' as never) as
      | string
      | undefined;

    return key?.trim() ? key.trim() : null;
  }

  private getRapidApiKey(): string | null {
    const key = this.environmentService.get(
      'RAPIDAPI_APOLLO_ORG_SEARCH_KEY' as never,
    ) as string | undefined;

    return key?.trim() ? key.trim() : null;
  }

  private getRapidApiHost(): string {
    const host = this.environmentService.get(
      'RAPIDAPI_APOLLO_ORG_SEARCH_HOST' as never,
    ) as string | undefined;

    return host?.trim()
      ? host.trim()
      : 'apollo-io-no-cookies-required.p.rapidapi.com';
  }

  isConfigured(): boolean {
    return this.getApiKey() !== null;
  }

  private assertConfigured(): string {
    const key = this.getApiKey();

    if (!key) {
      throw new HttpException(
        'Apollo API is not configured (APOLLO_API_KEY)',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    return key;
  }

  private logApolloRequestError(context: string, error: unknown): void {
    if (!isAxiosError(error)) {
      this.logger.error(`Apollo ${context} failed (non-axios)`, error);

      return;
    }
    const status = error.response?.status;
    const data = error.response?.data;
    let dataStr: string;

    if (data === undefined || data === null) {
      dataStr = 'n/a';
    } else if (typeof data === 'string') {
      dataStr = data.slice(0, 4000);
    } else {
      try {
        dataStr = JSON.stringify(data);
      } catch {
        dataStr = '[unserializable response data]';
      }
    }
    this.logger.error(
      `Apollo ${context} failed: status=${status ?? 'n/a'} body=${dataStr}`,
    );
  }

  private getOrgSearchCacheTtlMs(): number {
    const raw = this.environmentService.get(
      'APOLLO_ORG_SEARCH_CACHE_TTL_SEC' as never,
    ) as number | undefined;
    const sec =
      typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 86400;

    return Math.max(60, sec) * 1000;
  }

  private getOrgResolutionCacheTtlMs(): number {
    const raw = this.environmentService.get(
      'APOLLO_ORG_RESOLUTION_CACHE_TTL_SEC' as never,
    ) as number | undefined;
    const sec =
      typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 86400;

    return Math.max(60, sec) * 1000;
  }

  private getOrgResolutionNegativeCacheTtlMs(): number {
    const raw = this.environmentService.get(
      'APOLLO_ORG_RESOLUTION_NEGATIVE_CACHE_TTL_SEC' as never,
    ) as number | undefined;
    const sec =
      typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : 3600;

    return Math.max(60, sec) * 1000;
  }

  private buildOrgSearchCacheKey(
    input: ApolloOrganizationSearchParams,
  ): string {
    const domains = [...(input.q_organization_domains_list ?? [])]
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean)
      .sort();
    const locs = [...(input.organization_locations ?? [])]
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean)
      .sort();
    const employeeRanges = [...(input.organization_num_employees_ranges ?? [])]
      .map((r) => r.trim())
      .filter(Boolean)
      .sort();
    const keywordTags = [...(input.q_organization_keyword_tags ?? [])]
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .sort();

    return JSON.stringify({
      n: input.q_organization_name?.trim().toLowerCase() ?? '',
      d: domains,
      l: locs,
      er: employeeRanges,
      kt: keywordTags,
      p: input.page ?? 1,
      pp: input.per_page ?? 10,
    });
  }

  private cacheKeyDigest(key: string): string {
    return createHash('sha256').update(key).digest('hex').slice(0, 12);
  }

  private pruneCacheMap<K>(
    map: Map<K, { expiresAt: number }>,
    maxEntries: number,
  ): void {
    const now = Date.now();

    for (const [k, v] of map.entries()) {
      if (v.expiresAt <= now) {
        map.delete(k);
      }
    }
    while (map.size > maxEntries) {
      const first = map.keys().next().value as K | undefined;

      if (first === undefined) break;
      map.delete(first);
    }
  }

  private cloneOrgSearchPayload(
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    return JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
  }

  private buildOrgResolutionCacheKey(args: {
    candidateId?: string;
    companyName?: string;
    linkedinCompanyUrl?: string;
    domain?: string;
  }): string {
    const name = args.companyName?.trim().toLowerCase() ?? '';
    const fallback = args.candidateId?.trim().toLowerCase() ?? '';
    const searchName = name || fallback;
    const domain = args.domain?.trim().toLowerCase() ?? '';
    const slug = extractLinkedinCompanySlug(args.linkedinCompanyUrl) ?? '';

    return JSON.stringify({ s: searchName, d: domain, slug });
  }

  private redisOrgSearchStorageKey(cacheKey: string): string {
    return `apollo-org-search:v1:${createHash('sha256').update(cacheKey).digest('hex')}`;
  }

  private async readOrgSearchFromSharedCache(
    cacheKey: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      const redisKey = this.redisOrgSearchStorageKey(cacheKey);
      const v =
        await this.engineCandidateSearchCache.get<Record<string, unknown>>(
          redisKey,
        );

      return v ?? null;
    } catch (error: unknown) {
      this.logger.warn(
        `Apollo organizationsSearch Redis get failed digest=${this.cacheKeyDigest(cacheKey)}`,
        error instanceof Error ? error.message : error,
      );

      return null;
    }
  }

  private async writeOrgSearchToSharedCache(
    cacheKey: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const ttlSec = Math.max(
      60,
      Math.round(this.getOrgSearchCacheTtlMs() / 1000),
    );

    try {
      await this.engineCandidateSearchCache.set(
        this.redisOrgSearchStorageKey(cacheKey),
        this.cloneOrgSearchPayload(data),
        ttlSec,
      );
    } catch (error: unknown) {
      this.logger.warn(
        `Apollo organizationsSearch Redis set failed digest=${this.cacheKeyDigest(cacheKey)}`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  private buildRapidApiApolloOrgResponse(
    rapidData: Record<string, unknown>,
  ): Record<string, unknown> {
    const candidateLists = [
      rapidData.organizations,
      rapidData.results,
      rapidData.data,
      rapidData.companies,
    ];
    const list = candidateLists.find(Array.isArray);

    return {
      ...rapidData,
      organizations: Array.isArray(list) ? list : [],
    };
  }

  private async organizationsSearchViaRapidApi(
    input: ApolloOrganizationSearchParams,
  ): Promise<Record<string, unknown> | null> {
    const rapidApiKey = this.getRapidApiKey();

    if (!rapidApiKey) {
      return null;
    }

    const params = new URLSearchParams();

    if (input.q_organization_name?.trim()) {
      params.set('q_organization_name', input.q_organization_name.trim());
    }
    const page = input.page ?? 1;

    params.set('page', String(page));

    const url = `${RAPID_API_APOLLO_SEARCH_BASE}/search_organization?${params.toString()}`;

    this.logger.warn(
      `Falling back to RapidAPI org search ${url.slice(0, 200)}...`,
    );

    try {
      const { data } = await axios.get<Record<string, unknown>>(url, {
        timeout: 120_000,
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-host': this.getRapidApiHost(),
          'x-rapidapi-key': rapidApiKey,
        },
      });

      const normalized = this.buildRapidApiApolloOrgResponse(data);
      const organizations = normalized.organizations;
      const count = Array.isArray(organizations) ? organizations.length : 0;

      this.logger.log(
        `RapidAPI org search succeeded with ${count} organization(s)`,
      );

      return normalized;
    } catch (error) {
      this.logger.error('RapidAPI org search fallback failed', error);

      return null;
    }
  }

  /**
   * People API Search POST /mixed_people/api_search
   * @see https://docs.apollo.io/reference/people-api-search.md
   */
  async peopleSearch(
    input: ApolloPeopleSearchParams,
  ): Promise<Record<string, unknown>> {
    const apiKey = this.assertConfigured();
    const params = new URLSearchParams();

    if (input.q_keywords?.trim()) {
      params.set('q_keywords', input.q_keywords.trim());
    }
    appendApolloParams(params, 'person_titles', input.person_titles);
    if (input.include_similar_titles === false) {
      params.set('include_similar_titles', 'false');
    }
    appendApolloParams(params, 'person_locations', input.person_locations);
    appendApolloParams(
      params,
      'organization_locations',
      input.organization_locations,
    );
    appendApolloParams(params, 'organization_ids', input.organization_ids);
    appendApolloParams(
      params,
      'q_organization_domains_list',
      input.q_organization_domains_list,
    );
    appendApolloParams(params, 'person_seniorities', input.person_seniorities);
    const page = input.page ?? 1;
    const perPage = input.per_page ?? 25;

    params.set('page', String(page));
    params.set('per_page', String(perPage));

    const url = `/mixed_people/api_search?${params.toString()}`;

    this.logger.log(`Apollo peopleSearch ${url.slice(0, 200)}...`);

    try {
      const { data } = await this.client.post<Record<string, unknown>>(
        url,
        {},
        {
          headers: { 'x-api-key': apiKey },
        },
      );

      return data;
    } catch (error) {
      this.logApolloRequestError('peopleSearch', error);
      throw error;
    }
  }

  /**
   * Organization Search POST /mixed_companies/search (consumes credits)
   * @see https://docs.apollo.io/reference/organization-search.md
   */
  async organizationsSearch(
    input: ApolloOrganizationSearchParams,
  ): Promise<Record<string, unknown>> {
    const cacheKey = this.buildOrgSearchCacheKey(input);
    const cached = this.orgSearchResponseCache.get(cacheKey);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      const ttlSecLeft = Math.round((cached.expiresAt - now) / 1000);

      this.logger.log(
        `Apollo organizationsSearch cache hit digest=${this.cacheKeyDigest(cacheKey)} ttl_s_left=${ttlSecLeft} q_organization_name="${(input.q_organization_name ?? '').slice(0, 80)}"`,
      );

      return this.cloneOrgSearchPayload(cached.data);
    }

    const fromRedis = await this.readOrgSearchFromSharedCache(cacheKey);

    if (fromRedis) {
      const ttlMs = this.getOrgSearchCacheTtlMs();

      this.orgSearchResponseCache.set(cacheKey, {
        expiresAt: Date.now() + ttlMs,
        data: this.cloneOrgSearchPayload(fromRedis),
      });
      this.pruneCacheMap(
        this.orgSearchResponseCache,
        ApolloIoRestService.MAX_ORG_SEARCH_CACHE_ENTRIES,
      );
      this.logger.log(
        `Apollo organizationsSearch shared cache (Redis) hit digest=${this.cacheKeyDigest(cacheKey)} q_organization_name="${(input.q_organization_name ?? '').slice(0, 80)}"`,
      );

      return this.cloneOrgSearchPayload(fromRedis);
    }

    const apiKey = this.assertConfigured();
    const params = new URLSearchParams();

    if (input.q_organization_name?.trim()) {
      params.set('q_organization_name', input.q_organization_name.trim());
    }
    appendApolloParams(
      params,
      'q_organization_domains_list',
      input.q_organization_domains_list,
    );
    appendApolloParams(
      params,
      'organization_locations',
      input.organization_locations,
    );
    appendApolloParams(
      params,
      'organization_num_employees_ranges',
      input.organization_num_employees_ranges,
    );
    appendApolloParams(
      params,
      'q_organization_keyword_tags',
      input.q_organization_keyword_tags,
    );
    const page = input.page ?? 1;
    const perPage = input.per_page ?? 10;

    params.set('page', String(page));
    params.set('per_page', String(perPage));

    const url = `/mixed_companies/search?${params.toString()}`;

    this.logger.log(
      `Apollo organizationsSearch cache miss digest=${this.cacheKeyDigest(cacheKey)} ${url.slice(0, 200)}...`,
    );

    try {
      const { data } = await this.client.post<Record<string, unknown>>(
        url,
        {},
        {
          headers: { 'x-api-key': apiKey },
        },
      );
      const ttlMs = this.getOrgSearchCacheTtlMs();

      this.orgSearchResponseCache.set(cacheKey, {
        expiresAt: Date.now() + ttlMs,
        data: this.cloneOrgSearchPayload(data),
      });
      this.pruneCacheMap(
        this.orgSearchResponseCache,
        ApolloIoRestService.MAX_ORG_SEARCH_CACHE_ENTRIES,
      );
      await this.writeOrgSearchToSharedCache(cacheKey, data);

      return data;
    } catch (error) {
      this.logApolloRequestError('organizationsSearch', error);
      const rapidFallback = await this.organizationsSearchViaRapidApi(input);

      if (rapidFallback) {
        const ttlMs = this.getOrgSearchCacheTtlMs();

        this.orgSearchResponseCache.set(cacheKey, {
          expiresAt: Date.now() + ttlMs,
          data: this.cloneOrgSearchPayload(rapidFallback),
        });
        this.pruneCacheMap(
          this.orgSearchResponseCache,
          ApolloIoRestService.MAX_ORG_SEARCH_CACHE_ENTRIES,
        );
        await this.writeOrgSearchToSharedCache(cacheKey, rapidFallback);

        return rapidFallback;
      }
      throw error;
    }
  }

  /**
   * Resolve a candidate Apollo organization_id for the given company. If `candidate`
   * is already a 24-char ObjectId, return it. Otherwise search Apollo organizations by
   * company name and pick the match whose linkedin URL slug or primary domain matches
   * `linkedinCompanyUrl` / `domain`. Falls back to the top result when no strong match.
   */
  async resolveOrganizationIdForOrgChart(args: {
    candidateId?: string;
    companyName?: string;
    linkedinCompanyUrl?: string;
    domain?: string;
  }): Promise<{
    organizationId?: string;
    organizationName?: string;
    linkedinUrl?: string;
    primaryDomain?: string;
  }> {
    const candidate = args.candidateId?.trim();

    if (candidate && isApolloOrganizationId(candidate)) {
      this.logger.log(
        `Apollo resolveOrganizationIdForOrgChart skip API (caller supplied organization_id=${candidate.slice(0, 12)}…)`,
      );

      return { organizationId: candidate };
    }

    const name = args.companyName?.trim();
    const domain = args.domain?.trim().toLowerCase();
    const targetSlug = extractLinkedinCompanySlug(args.linkedinCompanyUrl);

    const searchName = name || candidate;

    if (!searchName) {
      return {};
    }

    const resolutionKey = this.buildOrgResolutionCacheKey(args);
    const resCached = this.orgResolutionCache.get(resolutionKey);
    const resNow = Date.now();

    if (resCached && resCached.expiresAt > resNow) {
      const ttlSecLeft = Math.round((resCached.expiresAt - resNow) / 1000);

      if (resCached.resolved === null) {
        this.logger.log(
          `Apollo resolveOrganizationIdForOrgChart cache hit (negative) digest=${this.cacheKeyDigest(resolutionKey)} ttl_s_left=${ttlSecLeft} searchName="${searchName.slice(0, 80)}"`,
        );

        return {};
      }
      this.logger.log(
        `Apollo resolveOrganizationIdForOrgChart cache hit digest=${this.cacheKeyDigest(resolutionKey)} ttl_s_left=${ttlSecLeft} organizationId=${resCached.resolved.organizationId ?? 'n/a'}`,
      );

      return {
        organizationId: resCached.resolved.organizationId,
        organizationName: resCached.resolved.organizationName,
        linkedinUrl: resCached.resolved.linkedinUrl,
        primaryDomain: resCached.resolved.primaryDomain,
      };
    }

    const raw = await this.organizationsSearch({
      q_organization_name: searchName,
      q_organization_domains_list: domain ? [domain] : undefined,
      page: 1,
      per_page: 10,
    });
    const organizations = (raw as { organizations?: unknown }).organizations;
    const list = Array.isArray(organizations)
      ? organizations.filter(
          (o): o is Record<string, unknown> =>
            o !== null && typeof o === 'object',
        )
      : [];

    if (list.length === 0) {
      const negTtl = this.getOrgResolutionNegativeCacheTtlMs();

      this.orgResolutionCache.set(resolutionKey, {
        expiresAt: Date.now() + negTtl,
        resolved: null,
      });
      this.pruneCacheMap(
        this.orgResolutionCache,
        ApolloIoRestService.MAX_ORG_RESOLUTION_CACHE_ENTRIES,
      );
      this.logger.log(
        `Apollo resolveOrganizationIdForOrgChart stored negative cache digest=${this.cacheKeyDigest(resolutionKey)} searchName="${searchName.slice(0, 80)}"`,
      );

      return {};
    }

    const byLinkedinSlug = targetSlug
      ? list.find((org) => {
          const url =
            typeof org.linkedin_url === 'string' ? org.linkedin_url : '';
          const slug = extractLinkedinCompanySlug(url);

          return slug && slug === targetSlug;
        })
      : undefined;

    const byDomain = domain
      ? list.find((org) => {
          const primary =
            typeof org.primary_domain === 'string'
              ? org.primary_domain.toLowerCase()
              : undefined;

          return primary && primary === domain;
        })
      : undefined;

    const byName = name
      ? list.find((org) => {
          const orgName =
            typeof org.name === 'string' ? org.name.trim().toLowerCase() : '';

          return orgName && orgName === name.toLowerCase();
        })
      : undefined;

    const chosen = byLinkedinSlug ?? byDomain ?? byName ?? list[0];
    const organizationId = String(chosen.organization_id ?? chosen.id ?? '');

    if (!organizationId) {
      const negTtl = this.getOrgResolutionNegativeCacheTtlMs();

      this.orgResolutionCache.set(resolutionKey, {
        expiresAt: Date.now() + negTtl,
        resolved: null,
      });
      this.pruneCacheMap(
        this.orgResolutionCache,
        ApolloIoRestService.MAX_ORG_RESOLUTION_CACHE_ENTRIES,
      );

      return {};
    }
    const organizationName =
      typeof chosen.name === 'string' ? chosen.name : undefined;
    const linkedinUrl =
      typeof chosen.linkedin_url === 'string' ? chosen.linkedin_url : undefined;
    const primaryDomain =
      typeof chosen.primary_domain === 'string'
        ? chosen.primary_domain
        : undefined;

    const resolvedPayload: ApolloResolvedOrganization = {
      organizationId,
      organizationName,
      linkedinUrl,
      primaryDomain,
    };
    const posTtl = this.getOrgResolutionCacheTtlMs();

    this.orgResolutionCache.set(resolutionKey, {
      expiresAt: Date.now() + posTtl,
      resolved: resolvedPayload,
    });
    this.pruneCacheMap(
      this.orgResolutionCache,
      ApolloIoRestService.MAX_ORG_RESOLUTION_CACHE_ENTRIES,
    );

    this.logger.log(
      `Apollo org resolved: name="${searchName}" → id=${organizationId} (linkedin=${linkedinUrl ?? 'n/a'}, domain=${primaryDomain ?? 'n/a'})`,
    );

    return { organizationId, organizationName, linkedinUrl, primaryDomain };
  }

  /**
   * POST /api/v1/people/match — enrich by Apollo person id + company domain.
   * @see https://docs.apollo.io/reference/people-api-search.md
   */
  async peopleMatch(input: {
    id: string;
    domain: string;
    /** Optional profile URL; sent as `linkedin_url` when disambiguation helps. */
    linkedinUrl?: string;
    revealPersonalEmails?: boolean;
    revealPhoneNumber?: boolean;
  }): Promise<Record<string, unknown>> {
    const apiKey = this.assertConfigured();
    const id = input.id?.trim();
    const domain = input.domain?.trim();

    if (!id || !domain) {
      throw new HttpException(
        'Apollo people/match requires id and domain',
        HttpStatus.BAD_REQUEST,
      );
    }
    const params = new URLSearchParams();

    params.set('id', id);
    params.set('domain', domain);
    const li = input.linkedinUrl?.trim();

    if (li) {
      params.set('linkedin_url', li);
    }
    if (input.revealPersonalEmails === true) {
      params.set('reveal_personal_emails', 'true');
    }
    if (input.revealPhoneNumber === true) {
      params.set('reveal_phone_number', 'true');
    }
    const url = `/people/match?${params.toString()}`;

    this.logger.log(
      `Apollo peopleMatch id=${id.slice(0, 8)}... domain=${domain}${li ? ' +linkedin' : ''}`,
    );
    try {
      const { data } = await this.client.post<Record<string, unknown>>(
        url,
        {},
        {
          headers: { 'x-api-key': apiKey },
        },
      );

      return data;
    } catch (error) {
      this.logApolloRequestError('peopleMatch', error);
      throw error;
    }
  }

  /**
   * Job postings GET /organizations/{organization_id}/job_postings (consumes credits)
   * @see https://docs.apollo.io/reference/organization-jobs-postings.md
   */
  async organizationJobPostings(
    organizationId: string,
    page?: number,
    perPage?: number,
  ): Promise<Record<string, unknown>> {
    const apiKey = this.assertConfigured();
    const id = organizationId.trim();

    if (!id) {
      throw new HttpException(
        'organizationId is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    const params = new URLSearchParams();

    params.set('page', String(page ?? 1));
    params.set('per_page', String(perPage ?? 25));

    const url = `/organizations/${encodeURIComponent(id)}/job_postings?${params.toString()}`;

    this.logger.log(`Apollo organizationJobPostings org=${id}`);

    try {
      const { data } = await this.client.get<Record<string, unknown>>(url, {
        headers: { 'x-api-key': apiKey },
      });

      return data;
    } catch (error) {
      this.logApolloRequestError('organizationJobPostings', error);
      throw error;
    }
  }
}
