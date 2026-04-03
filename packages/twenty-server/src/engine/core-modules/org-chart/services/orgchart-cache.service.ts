import { Injectable, Logger } from '@nestjs/common';
import { InjectCacheStorage } from 'src/engine/core-modules/cache-storage/decorators/cache-storage.decorator';
import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { CacheStorageNamespace } from 'src/engine/core-modules/cache-storage/types/cache-storage-namespace.enum';
import { OrgChartData } from 'twenty-shared';
import {
    buildCompanyOrgChartCandidateListLogicalCacheKey,
    buildCompanyOrgChartLogicalCacheKey,
} from '../utils/orgchart-cache-keys.util';
import {
    normalizeCompanyId,
    normalizeCompanyName,
    normalizeCountry,
    normalizeFunctionRoot,
} from '../utils/orgchart-normalization.util';

export type CachedCompanyOrgChartPayload = {
  companyId: string;
  companyName: string;
  mode: 'entire_company';
  searchType?: 'classic' | 'sales_navigator' | 'recruiter';
  orgChart: OrgChartData;
  items: any[];
  itemCount: number;
  cachedAt: string;
  /** True if credits were debited when this org chart was created. Undefined = legacy cache (treated as true). */
  creditsDebited?: boolean;
};

export type CachedCompanyCandidateListPayload = {
  companyId: string;
  companyName: string;
  mode: 'entire_company';
  searchType?: 'classic' | 'sales_navigator' | 'recruiter';
  items: any[];
  itemCount: number;
  cachedAt: string;
};

export type CachedFunctionGradeSearchPayload = {
  companyId: string;
  companyName: string;
  functionRoot: string;
  country: string;
  searchType: 'classic' | 'sales_navigator' | 'recruiter';
  strategyCap: number;
  keywordsHash: string;
  items: any[];
  itemCount: number;
  orgChart?: OrgChartData;
  cachedAt: string;
};

const ORG_CHART_FUNCTION_GRADE_CACHE_KEY_PREFIX = 'function-grade-orgchart';
const DEFAULT_ORG_CHART_COMPANY_CACHE_TTL_SECONDS = 60 * 60 * 24 * 90;
const DEFAULT_ORG_CHART_COMPANY_CANDIDATES_CACHE_TTL_SECONDS =
  60 * 60 * 24 * 90;
const DEFAULT_ORG_CHART_FUNCTION_GRADE_CACHE_TTL_SECONDS =
  60 * 60 * 24 * 30;
const THREE_MONTHS_IN_MS = 1000 * 60 * 60 * 24 * 90;
const DEFAULT_ORG_CHART_MIN_PEOPLE_TO_CACHE = 3;

@Injectable()
export class OrgChartCacheService {
  private readonly logger = new Logger(OrgChartCacheService.name);

  constructor(
    @InjectCacheStorage(CacheStorageNamespace.EngineOrgChart)
    private readonly orgChartCacheStorageService: CacheStorageService,
  ) {}

  async getCachedCompanyOrgChart(input: {
    companyName?: string;
    companyId?: string;
    mode: 'entire_company';
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
  }): Promise<CachedCompanyOrgChartPayload | undefined> {
    const cacheKey = buildCompanyOrgChartLogicalCacheKey(
      input.companyName,
      input.companyId,
      input.mode,
      input.searchType,
    );

    const cached =
      await this.orgChartCacheStorageService.get<CachedCompanyOrgChartPayload>(
        cacheKey,
      );

    if (!cached?.orgChart) {
      this.logger.log(
        `Orgchart cache MISS: key=${cacheKey} (company="${input.companyName ?? input.companyId ?? ''}")`,
      );
      return undefined;
    }

    this.logger.log(
      `Orgchart cache HIT: key=${cacheKey}, itemCount=${cached.itemCount}, cachedAt=${cached.cachedAt}`,
    );

    return cached;
  }

  async getCachedCompanyCandidateList(input: {
    companyName?: string;
    companyId?: string;
    mode: 'entire_company';
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
  }): Promise<CachedCompanyCandidateListPayload | undefined> {
    const cacheKey = buildCompanyOrgChartCandidateListLogicalCacheKey(
      input.companyName,
      input.companyId,
      input.mode,
      input.searchType,
    );

    const cached =
      await this.orgChartCacheStorageService.get<CachedCompanyCandidateListPayload>(
        cacheKey,
      );

    if (!cached?.items || !Array.isArray(cached.items)) {
      this.logger.log(
        `Candidate list cache MISS: key=${cacheKey} (company="${input.companyName ?? input.companyId ?? ''}")`,
      );
      return undefined;
    }

    const cacheAgeMs = this.getCacheAgeMs(cached.cachedAt);
    const isFresh = this.isCompanyCandidateListCacheFresh(cached.cachedAt);

    if (!isFresh) {
      const ageDays =
        typeof cacheAgeMs === 'number'
          ? Math.floor(cacheAgeMs / (1000 * 60 * 60 * 24))
          : 'unknown';
      this.logger.log(
        `Candidate list cache STALE: key=${cacheKey}, ageDays=${ageDays}, cachedAt=${cached.cachedAt}`,
      );
      return undefined;
    }

    this.logger.log(
      `Candidate list cache HIT: key=${cacheKey}, itemCount=${cached.itemCount}, cachedAt=${cached.cachedAt}`,
    );

    return cached;
  }

  async setCachedCompanyOrgChart(input: {
    companyName?: string;
    companyId?: string;
    mode: 'entire_company';
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
    orgChart: OrgChartData;
    items: any[];
    itemCount: number;
    /** True if credits were debited when creating this org chart. Default true for backward compat. */
    creditsDebited?: boolean;
  }): Promise<void> {
    const normalizedCompanyName = normalizeCompanyName(input.companyName);
    const normalizedCompanyId = normalizeCompanyId(
      input.companyId,
      normalizedCompanyName,
    );
    const cacheKey = buildCompanyOrgChartLogicalCacheKey(
      normalizedCompanyName,
      normalizedCompanyId,
      input.mode,
      input.searchType,
    );

    const payload: CachedCompanyOrgChartPayload = {
      companyId: normalizedCompanyId,
      companyName: normalizedCompanyName,
      mode: input.mode,
      searchType: input.searchType,
      orgChart: input.orgChart,
      items: input.items,
      itemCount: input.itemCount,
      cachedAt: new Date().toISOString(),
      creditsDebited: input.creditsDebited ?? true,
    };

    const ttlFromEnv = Number(process.env.ORG_CHART_COMPANY_CACHE_TTL_SECONDS);
    const ttlSeconds =
      Number.isFinite(ttlFromEnv) && ttlFromEnv > 0
        ? Math.floor(ttlFromEnv)
        : DEFAULT_ORG_CHART_COMPANY_CACHE_TTL_SECONDS;

    await this.orgChartCacheStorageService.set(cacheKey, payload, ttlSeconds);
    this.logger.log(
      `Orgchart cache WRITE: key=${cacheKey}, itemCount=${payload.itemCount}, ttlSeconds=${ttlSeconds}, cachedAt=${payload.cachedAt}`,
    );
  }

  shouldCacheCompanyOrgChart(input: {
    orgChart: OrgChartData | undefined;
    fallbackCandidateCount?: number;
    companyName?: string;
    companyId?: string;
  }): boolean {
    const { orgChart, fallbackCandidateCount = 0, companyName, companyId } =
      input;

    if (!orgChart || typeof orgChart !== 'object') {
      this.logger.warn(
        `Orgchart cache SKIP: invalid org chart payload for company="${companyName ?? companyId ?? ''}"`,
      );
      return false;
    }

    const inferredPeopleCount = this.inferPeopleCountFromOrgChart(orgChart);
    const ttlMinFromEnv = Number(process.env.ORG_CHART_MIN_PEOPLE_TO_CACHE);
    const minPeopleToCache =
      Number.isFinite(ttlMinFromEnv) && ttlMinFromEnv > 0
        ? Math.floor(ttlMinFromEnv)
        : DEFAULT_ORG_CHART_MIN_PEOPLE_TO_CACHE;

    const effectivePeopleCount = Math.max(
      inferredPeopleCount,
      fallbackCandidateCount,
    );

    if (effectivePeopleCount < minPeopleToCache) {
      this.logger.warn(
        `Orgchart cache SKIP: sparse org chart for company="${companyName ?? companyId ?? ''}" (inferredPeopleCount=${inferredPeopleCount}, fallbackCandidateCount=${fallbackCandidateCount}, minPeopleToCache=${minPeopleToCache})`,
      );
      return false;
    }

    this.logger.log(
      `Orgchart cache ELIGIBLE: company="${companyName ?? companyId ?? ''}" (inferredPeopleCount=${inferredPeopleCount}, fallbackCandidateCount=${fallbackCandidateCount}, minPeopleToCache=${minPeopleToCache})`,
    );

    return true;
  }

  async setCachedCompanyCandidateList(input: {
    companyName?: string;
    companyId?: string;
    mode: 'entire_company';
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
    items: any[];
    itemCount: number;
  }): Promise<void> {
    const normalizedCompanyName = normalizeCompanyName(input.companyName);
    const normalizedCompanyId = normalizeCompanyId(
      input.companyId,
      normalizedCompanyName,
    );
    const cacheKey = buildCompanyOrgChartCandidateListLogicalCacheKey(
      normalizedCompanyName,
      normalizedCompanyId,
      input.mode,
      input.searchType,
    );

    const payload: CachedCompanyCandidateListPayload = {
      companyId: normalizedCompanyId,
      companyName: normalizedCompanyName,
      mode: input.mode,
      searchType: input.searchType,
      items: input.items,
      itemCount: input.itemCount,
      cachedAt: new Date().toISOString(),
    };

    const ttlFromEnv = Number(
      process.env.ORG_CHART_COMPANY_CANDIDATES_CACHE_TTL_SECONDS,
    );
    const ttlSeconds =
      Number.isFinite(ttlFromEnv) && ttlFromEnv > 0
        ? Math.floor(ttlFromEnv)
        : DEFAULT_ORG_CHART_COMPANY_CANDIDATES_CACHE_TTL_SECONDS;

    await this.orgChartCacheStorageService.set(cacheKey, payload, ttlSeconds);
    this.logger.log(
      `Candidate list cache WRITE: key=${cacheKey}, itemCount=${payload.itemCount}, ttlSeconds=${ttlSeconds}, cachedAt=${payload.cachedAt}`,
    );
  }

  /**
   * Deletes Redis keys for full-company classic org chart + candidate list caches.
   * Used by live E2E and ops to force a cold fetch from Unipile / Python.
   */
  async invalidateEntireCompanyClassicCaches(input: {
    companyName?: string;
    companyId?: string;
  }): Promise<void> {
    const orgChartKey = buildCompanyOrgChartLogicalCacheKey(
      input.companyName,
      input.companyId,
      'entire_company',
      'classic',
    );
    const candidateListKey = buildCompanyOrgChartCandidateListLogicalCacheKey(
      input.companyName,
      input.companyId,
      'entire_company',
      'classic',
    );
    await this.orgChartCacheStorageService.del(orgChartKey);
    await this.orgChartCacheStorageService.del(candidateListKey);
    this.logger.log(
      `Orgchart cache INVALIDATE: orgChartKey=${orgChartKey}, candidateListKey=${candidateListKey}`,
    );
  }

  async getCachedFunctionGradeSearch(input: {
    companyName?: string;
    companyId?: string;
    functionRoot: string;
    country: string;
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
    strategyCap: number;
    keywordsHash: string;
  }): Promise<CachedFunctionGradeSearchPayload | undefined> {
    const cacheKey = this.buildFunctionGradeCacheKey(input);
    const cached =
      await this.orgChartCacheStorageService.get<CachedFunctionGradeSearchPayload>(
        cacheKey,
      );

    if (!cached?.items || !Array.isArray(cached.items)) {
      this.logger.log(
        `Function-grade cache MISS: key=${cacheKey} (company="${input.companyName ?? input.companyId ?? ''}", functionRoot="${input.functionRoot}", country="${input.country}")`,
      );
      return undefined;
    }

    this.logger.log(
      `Function-grade cache HIT: key=${cacheKey}, itemCount=${cached.itemCount}, cachedAt=${cached.cachedAt}`,
    );
    return cached;
  }

  async setCachedFunctionGradeSearch(input: {
    companyName?: string;
    companyId?: string;
    functionRoot: string;
    country: string;
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
    strategyCap: number;
    keywordsHash: string;
    items: any[];
    itemCount: number;
    orgChart?: OrgChartData;
  }): Promise<void> {
    const normalizedCompanyName = normalizeCompanyName(input.companyName);
    const normalizedCompanyId = normalizeCompanyId(
      input.companyId,
      normalizedCompanyName,
    );
    const normalizedFunctionRoot = normalizeFunctionRoot(input.functionRoot);
    const normalizedCountry = normalizeCountry(input.country);

    const cacheKey = this.buildFunctionGradeCacheKey({
      companyName: normalizedCompanyName,
      companyId: normalizedCompanyId,
      functionRoot: normalizedFunctionRoot,
      country: normalizedCountry,
      searchType: input.searchType,
      strategyCap: input.strategyCap,
      keywordsHash: input.keywordsHash,
    });

    const payload: CachedFunctionGradeSearchPayload = {
      companyId: normalizedCompanyId,
      companyName: normalizedCompanyName,
      functionRoot: normalizedFunctionRoot,
      country: normalizedCountry,
      searchType: input.searchType,
      strategyCap: input.strategyCap,
      keywordsHash: input.keywordsHash,
      items: input.items,
      itemCount: input.itemCount,
      ...(input.orgChart ? { orgChart: input.orgChart } : {}),
      cachedAt: new Date().toISOString(),
    };

    const ttlFromEnv = Number(
      process.env.ORG_CHART_FUNCTION_GRADE_CACHE_TTL_SECONDS,
    );
    const ttlSeconds =
      Number.isFinite(ttlFromEnv) && ttlFromEnv > 0
        ? Math.floor(ttlFromEnv)
        : DEFAULT_ORG_CHART_FUNCTION_GRADE_CACHE_TTL_SECONDS;

    await this.orgChartCacheStorageService.set(cacheKey, payload, ttlSeconds);
    this.logger.log(
      `Function-grade cache WRITE: key=${cacheKey}, itemCount=${payload.itemCount}, ttlSeconds=${ttlSeconds}, cachedAt=${payload.cachedAt}, hasOrgChart=${!!payload.orgChart}`,
    );
  }

  private buildFunctionGradeCacheKey(input: {
    companyName?: string;
    companyId?: string;
    functionRoot: string;
    country: string;
    searchType: 'classic' | 'sales_navigator' | 'recruiter';
    strategyCap: number;
    keywordsHash: string;
  }): string {
    const normalizedCompanyName = normalizeCompanyName(input.companyName);
    const normalizedCompanyId = normalizeCompanyId(
      input.companyId,
      normalizedCompanyName,
    );
    const normalizedFunctionRoot = normalizeFunctionRoot(input.functionRoot);
    const normalizedCountry = normalizeCountry(input.country);
    const normalizedKeywordsHash = (input.keywordsHash || '').trim().toLowerCase();
    const strategyCap = Number.isFinite(input.strategyCap) && input.strategyCap > 0
      ? Math.floor(input.strategyCap)
      : 1;

    return [
      ORG_CHART_FUNCTION_GRADE_CACHE_KEY_PREFIX,
      normalizedCompanyId,
      normalizedFunctionRoot || 'unknown_function',
      normalizedCountry || 'global',
      input.searchType,
      `cap_${strategyCap}`,
      normalizedKeywordsHash || 'no_keywords_hash',
    ].join(':');
  }

  private isCompanyCandidateListCacheFresh(cachedAt: string): boolean {
    const cacheAgeMs = this.getCacheAgeMs(cachedAt);
    if (cacheAgeMs === undefined) {
      return false;
    }

    return cacheAgeMs < THREE_MONTHS_IN_MS;
  }

  private inferPeopleCountFromOrgChart(orgChart: Record<string, unknown>): number {
    const directPeopleCount = this.getPeopleCountFromDirectField(orgChart);
    if (directPeopleCount > 0) {
      return directPeopleCount;
    }

    const orgchartField = (orgChart as { orgchart?: unknown }).orgchart;
    if (typeof orgchartField === 'string') {
      try {
        const parsed = JSON.parse(orgchartField) as unknown;
        return this.countPeopleLikeEntries(parsed);
      } catch {
        return 0;
      }
    }

    if (Array.isArray(orgchartField) || typeof orgchartField === 'object') {
      return this.countPeopleLikeEntries(orgchartField);
    }

    return this.countPeopleLikeEntries(orgChart);
  }

  private getPeopleCountFromDirectField(orgChart: Record<string, unknown>): number {
    const possibleCountFields = [
      'people_count',
      'peopleCount',
      'candidate_count',
      'candidateCount',
      'total_people',
      'totalPeople',
      'itemCount',
    ] as const;

    for (const field of possibleCountFields) {
      const value = (orgChart as Record<string, unknown>)[field];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        return Math.floor(value);
      }
    }

    return 0;
  }

  private countPeopleLikeEntries(value: unknown): number {
    const uniqueNames = new Set<string>();

    const visit = (node: unknown) => {
      if (Array.isArray(node)) {
        node.forEach((child) => visit(child));
        return;
      }

      if (!node || typeof node !== 'object') {
        return;
      }

      const record = node as Record<string, unknown>;
      for (const [key, rawValue] of Object.entries(record)) {
        if (key.startsWith('name_') && typeof rawValue === 'string') {
          const normalizedName = rawValue.trim().toLowerCase();
          if (normalizedName.length > 0) {
            uniqueNames.add(normalizedName);
          }
        } else if (typeof rawValue === 'object') {
          visit(rawValue);
        } else if (Array.isArray(rawValue)) {
          visit(rawValue);
        }
      }
    };

    visit(value);
    return uniqueNames.size;
  }

  private getCacheAgeMs(cachedAt: string): number | undefined {
    const cachedTimestamp = Date.parse(cachedAt);
    if (!Number.isFinite(cachedTimestamp)) {
      return undefined;
    }

    return Date.now() - cachedTimestamp;
  }
}
