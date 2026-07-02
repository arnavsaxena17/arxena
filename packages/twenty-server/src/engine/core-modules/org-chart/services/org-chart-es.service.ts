import { Injectable, Logger } from '@nestjs/common';

import { Client } from '@elastic/elasticsearch';

import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';

import { buildCompanyWebsiteLookupVariants, isUsableOrgChartEsDocument, isUsableOrgChartResolveCompanyId } from '../utils/org-chart-resolve-domain.util';

type OrgChartDocument = Record<string, unknown>;

export type OrgChartEsDomainResolveHit = {
  companyId: string;
  companyName?: string;
  website?: string;
  source: 'orgcharts' | 'companies';
  hasOrgChart: boolean;
  countOrg?: number;
};

export type OrgChartEsGetByCompanyIdOutcome = {
  document: OrgChartDocument | null;
  /** True when the ES client failed with a transport-layer error (e.g. connect timeout), not when no document matched. */
  esTransportError?: boolean;
};

function isElasticsearchTransportLayerError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const err = error as { name?: string; message?: string };
  const name = err.name ?? '';
  const msg = (err.message ?? '').toLowerCase();
  if (name === 'ConnectionError' || name === 'TimeoutError') {
    return true;
  }
  if (msg.includes('timeout')) {
    return true;
  }
  if (msg.includes('econnreset') || msg.includes('econnrefused')) {
    return true;
  }
  return false;
}

@Injectable()
export class OrgChartEsService {
  private readonly logger = new Logger(OrgChartEsService.name);
  private readonly client: Client | null;
  private readonly orgChartsIndex: string;

  constructor(private readonly environmentService: EnvironmentService) {
    const endpoint = this.environmentService.get('ES_ENDPOINT');
    const index =
      (this.environmentService.get('ORGCHARTS_ES_INDEX') as string | undefined) ??
      'org-charts-all';

    this.orgChartsIndex = index;

    if (typeof endpoint === 'string' && endpoint.length > 0) {
      this.client = new Client({
        node: endpoint,
      });
      this.logger.log(
        `Org charts Elasticsearch client configured for index "${this.orgChartsIndex}"`,
      );
    } else {
      this.client = null;
      this.logger.warn(
        'ES_ENDPOINT not configured, org chart ES queries are disabled',
      );
    }
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  getIndexName(): string {
    return this.orgChartsIndex;
  }

  private normalizeCompanyId(companyId: string): string {
    return companyId.trim().toLowerCase();
  }

  async getOrgChartByCompanyId(
    companyId: string,
    options?: {
      companyName?: string;
      website?: string;
      country?: string;
      functionRoot?: string;
    },
  ): Promise<OrgChartEsGetByCompanyIdOutcome> {
    if (!this.client) {
      return { document: null };
    }

    const normalizedCompanyId = this.normalizeCompanyId(companyId);

    if (!normalizedCompanyId) {
      this.logger.warn('Empty companyId provided to getOrgChartByCompanyId');
      return { document: null };
    }

    const {
      companyName,
      website,
      country: countryOverride,
      functionRoot,
    } = options ?? {};
    const normalizedCompanyName = companyName?.trim().toLowerCase();

    const shouldClauses: Record<string, unknown>[] = [
      {
        match: {
          // Mirrors ESOrgQueryGenerator.create_es_query_orgcharts_job_company_name
          job_company_id: normalizedCompanyId,
        },
      },
    ];

    if (normalizedCompanyName && normalizedCompanyName.length > 0) {
      shouldClauses.push({
        match: {
          job_company_name: normalizedCompanyName,
        },
      });
    }

    if (website && website.trim().length > 0) {
      shouldClauses.push({
        match: {
          job_company_website: website.trim(),
        },
      });
    }

    const mustClauses: Record<string, unknown>[] = [];

    if (shouldClauses.length > 0) {
      mustClauses.push({
        bool: {
          should: shouldClauses,
        },
      });
    }

    const countryValue =
      countryOverride && countryOverride.trim().length > 0
        ? countryOverride.trim()
        : 'global';

    mustClauses.push({
      match: {
        country: countryValue,
      },
    });

    const typeValue =
      functionRoot && functionRoot.trim().length > 0
        ? functionRoot.trim()
        : 'fullcompany';

    mustClauses.push({
      match: {
        // Mirrors ESOrgQueryGenerator.create_es_query_orgcharts_type
        type: typeValue,
      },
    });

    const query = {
      bool: {
        must: mustClauses,
      },
    };

    try {
      this.logger.log(
        `Executing org chart ES query for companyId=${normalizedCompanyId}, companyName=${normalizedCompanyName ?? ''}, website=${website ?? ''}, country=${countryValue}, type=${typeValue}: ${JSON.stringify(
          query,
        ).slice(0, 4000)}`,
      );

      const response = await this.client.search<OrgChartDocument>({
        index: this.orgChartsIndex,
        // keep result set small; Python version also fetches a single doc
        size: 5,
        track_total_hits: true,
        query,
      });

      const firstHit = response.hits.hits[0];

      if (!firstHit?._source) {
        this.logger.warn(
          `No org chart document found in ES for companyId=${companyId}`,
        );
        return { document: null };
      }

      this.logger.log(
        `Org chart ES query succeeded for companyId=${companyId}, totalHits=${JSON.stringify(
          response.hits.total,
        )}`,
      );

      return { document: firstHit._source };
    } catch (error) {
      this.logger.error(
        `Elasticsearch org chart query failed for companyId=${companyId}`,
        error as Error,
      );
      const esTransportError = isElasticsearchTransportLayerError(error);
      return { document: null, ...(esTransportError ? { esTransportError: true } : {}) };
    }
  }

  /**
   * Get top 10 companies most commonly hired from (prior employers of people
   * who joined this company). Returns company ids, names, and websites for
   * linking to org charts and displaying logos.
   */
  async getTopHiredFromCompanies(
    companyId: string,
  ): Promise<{ id: string; name: string; website?: string }[]> {
    if (!this.client) {
      return [];
    }

    const normalizedCompanyId = this.normalizeCompanyId(companyId);

    if (!normalizedCompanyId) {
      return [];
    }

    const companiesIndex =
      (this.environmentService.get('COMPANIES_ES_INDEX') as string | undefined) ??
      'companies_index_text';

    try {
      const searchResponse = await this.client.search<{
        id?: string;
        name?: string;
        website?: string;
        top_ten_before_companies?: string[];
      }>({
        index: companiesIndex,
        size: 1,
        query: {
          bool: {
            should: [
              { term: { id: normalizedCompanyId } },
              { term: { 'name.keyword': normalizedCompanyId } },
            ],
          },
        },
        _source: ['top_ten_before_companies', 'name'],
      });

      const hit = searchResponse.hits.hits[0];
      const topTen = hit?._source?.top_ten_before_companies;

      if (!Array.isArray(topTen) || topTen.length === 0) {
        return [];
      }

      const idsToFetch = topTen.slice(0, 10);

      const fetchResponse = await this.client.search<{
        id?: string;
        name?: string;
        website?: string;
      }>({
        index: companiesIndex,
        size: idsToFetch.length,
        query: { terms: { id: idsToFetch } },
        _source: ['id', 'name', 'website'],
      });

      const byId = new Map<string, { id: string; name: string; website?: string }>();
      for (const h of fetchResponse.hits.hits) {
        const src = h._source;
        if (!src?.id) continue;
        const id = String(src.id);
        const name =
          typeof src.name === 'string' && src.name.trim()
            ? src.name
            : id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        byId.set(id, {
          id,
          name,
          website: typeof src.website === 'string' ? src.website : undefined,
        });
      }

      return idsToFetch
        .map((id) => byId.get(id))
        .filter((c): c is { id: string; name: string; website?: string } => !!c);
    } catch (error) {
      this.logger.error(
        `Elasticsearch getTopHiredFromCompanies failed for companyId=${companyId}`,
        error as Error,
      );
      return [];
    }
  }

  /** Company IDs to exclude from sitemap indexing (e.g. government/military). */
  private static readonly SITEMAP_EXCLUDED_COMPANY_IDS = new Set([
    'us-army',
    'us-navy',
    'united-states-air-force',
    'united-states-marine-corps'
  
  ]);

  /**
   * Get company IDs that have org charts in ES, for sitemap indexing.
   * Returns up to limit companies (default 100), ordered by max count_org
   * (employee count in org chart) descending.
   * Excludes companies in SITEMAP_EXCLUDED_COMPANY_IDS.
   */
  async getIndexedCompanyIds(limit = 250): Promise<string[]> {
    if (!this.client) {
      return [];
    }

    try {
      const response = await this.client.search({
        index: this.orgChartsIndex,
        size: 0,
        aggs: {
          companies: {
            terms: {
              field: 'job_company_id',
              size: limit + 50,
              order: { max_count_org: 'desc' },
            },
            aggs: {
              max_count_org: {
                max: { field: 'count_org' },
              },
            },
          },
        },
      });

      const buckets = (response.aggregations?.companies as { buckets?: Array<{ key: string }> })
        ?.buckets ?? [];
      return buckets
        .map((b) => b.key)
        .filter(
          (id): id is string =>
            !!id && !OrgChartEsService.SITEMAP_EXCLUDED_COMPANY_IDS.has(id),
        )
        .slice(0, limit);
    } catch (error) {
      this.logger.error(
        'Elasticsearch getIndexedCompanyIds failed',
        error as Error,
      );
      return [];
    }
  }

  /**
   * Get company IDs paginated by rank (max count_org descending).
   * Used for sitemap company-level grouping.
   */
  async getIndexedCompanyIdsPaginated(
    offset: number,
    limit: number,
  ): Promise<string[]> {
    if (!this.client || limit < 1) {
      return [];
    }

    try {
      const response = await this.client.search({
        index: this.orgChartsIndex,
        size: 0,
        query: {
          bool: {
            must_not: [
              { term: { type: '0' } },
              ...Array.from(
                OrgChartEsService.SITEMAP_EXCLUDED_COMPANY_IDS,
              ).map((id) => ({ term: { job_company_id: id } })),
            ],
          },
        },
        aggs: {
          companies: {
            terms: {
              field: 'job_company_id',
              size: offset + limit + 100,
              order: { max_count_org: 'desc' },
            },
            aggs: {
              max_count_org: {
                max: { field: 'count_org' },
              },
              page_bucket: {
                bucket_sort: {
                  from: offset,
                  size: limit,
                },
              },
            },
          },
        },
      });

      const buckets = (response.aggregations?.companies as {
        buckets?: Array<{ key: string }>;
      })?.buckets ?? [];
      return buckets
        .map((b) => b.key)
        .filter(
          (id): id is string =>
            !!id && !OrgChartEsService.SITEMAP_EXCLUDED_COMPANY_IDS.has(id),
        );
    } catch (error) {
      this.logger.error(
        'Elasticsearch getIndexedCompanyIdsPaginated failed',
        error as Error,
      );
      return [];
    }
  }

  /** Chunk size for search_after pagination (stays within ES default limits). */
  private static readonly SEARCH_AFTER_CHUNK_SIZE = 1000;

  /** Sitemap batch sizes: 500, 2500, 5000, 25000, 50000, 50000, ... */
  private static readonly BATCH_SIZES = [500, 2500, 5000, 25000, 50000];

  private static getOffsetAndLimitForBatch(batchIndex: number): {
    offset: number;
    limit: number;
  } {
    if (batchIndex === 0) {
      return { offset: 0, limit: OrgChartEsService.BATCH_SIZES[0] };
    }
    let offset = 0;
    for (let i = 0; i < batchIndex; i++) {
      offset +=
        OrgChartEsService.BATCH_SIZES[
          Math.min(i, OrgChartEsService.BATCH_SIZES.length - 1)
        ];
    }
    const limit =
      batchIndex < OrgChartEsService.BATCH_SIZES.length
        ? OrgChartEsService.BATCH_SIZES[batchIndex]
        : OrgChartEsService.BATCH_SIZES[
            OrgChartEsService.BATCH_SIZES.length - 1
          ];
    return { offset, limit };
  }

  private static computeCutoffForCount(count: number): number {
    let cumulative = 0;
    let batchIndex = 0;
    while (cumulative < count && batchIndex < 500) {
      const { limit } = OrgChartEsService.getOffsetAndLimitForBatch(batchIndex);
      cumulative += limit;
      batchIndex++;
    }
    return batchIndex;
  }

  /**
   * Fetch one chunk of (companyId, country, type) tuples using search_after.
   * Returns urls and nextSearchAfter for chaining. Excludes type '0' and SITEMAP_EXCLUDED_COMPANY_IDS.
   */
  async getIndexedUrlsPaginatedWithSearchAfter(
    options: {
      country?: string;
      type?: string;
      size?: number;
      searchAfter?: unknown[];
    } = {},
  ): Promise<{
    urls: { companyId: string; country: string; type: string }[];
    nextSearchAfter: unknown[] | null;
  }> {
    if (!this.client) {
      return { urls: [], nextSearchAfter: null };
    }

    const size = Math.min(
      options.size ?? OrgChartEsService.SEARCH_AFTER_CHUNK_SIZE,
      5000,
    );
    const excludeIds = Array.from(
      OrgChartEsService.SITEMAP_EXCLUDED_COMPANY_IDS,
    );

    const mustNotClauses: Record<string, unknown>[] = [
      { term: { type: '0' } },
      ...excludeIds.map((id) => ({ term: { job_company_id: id } })),
    ];

    const mustClauses: Record<string, unknown>[] = [];
    if (options.country && options.country.trim()) {
      mustClauses.push({
        term: { country: options.country.trim() },
      });
    }
    if (options.type && options.type.trim()) {
      mustClauses.push({
        term: { type: options.type.trim() },
      });
    }

    const query: Record<string, unknown> = {
      bool: {
        must_not: mustNotClauses,
        ...(mustClauses.length > 0 ? { must: mustClauses } : {}),
      },
    };

    // Avoid sorting by _id: on large indexes (23M+ docs) it triggers CircuitBreakingException.
    // Use doc-value fields for deterministic tie-breaker instead.
    const searchBody: Record<string, unknown> = {
      index: this.orgChartsIndex,
      size,
      _source: ['job_company_id', 'country', 'type'],
      query,
      sort: [
        { count_org: { order: 'desc' } },
        { job_company_id: { order: 'asc' } },
        { country: { order: 'asc' } },
        { type: { order: 'asc' } },
      ],
    };

    if (options.searchAfter && Array.isArray(options.searchAfter)) {
      searchBody.search_after = options.searchAfter;
    }

    try {
      const response = await this.client.search<{
        job_company_id?: string;
        country?: string;
        type?: string;
      }>(searchBody);

      const hits = response.hits.hits;
      const urls: { companyId: string; country: string; type: string }[] = [];

      for (const hit of hits) {
        const src = hit._source;
        if (!src || typeof src.job_company_id !== 'string') continue;
        const companyId = String(src.job_company_id).trim();
        if (!companyId) continue;
        const country =
          typeof src.country === 'string' && src.country.trim()
            ? src.country.trim()
            : 'global';
        const type =
          typeof src.type === 'string' && src.type.trim()
            ? src.type.trim()
            : 'fullcompany';
        urls.push({ companyId, country, type });
      }

      const lastHit = hits[hits.length - 1];
      const nextSearchAfter =
        lastHit?.sort
          ? (lastHit.sort as unknown[])
          : null;

      return {
        urls,
        nextSearchAfter:
          nextSearchAfter && hits.length === size ? nextSearchAfter : null,
      };
    } catch (error) {
      this.logger.error(
        'Elasticsearch getIndexedUrlsPaginatedWithSearchAfter failed',
        error as Error,
      );
      return { urls: [], nextSearchAfter: null };
    }
  }

  /**
   * Get URLs for sitemap batch using chained search_after requests.
   * Skips first offset URLs, then collects limit URLs.
   */
  async getIndexedUrlsWithSearchAfterChaining(options: {
    offset: number;
    limit: number;
    country?: string;
    type?: string;
  }): Promise<{ companyId: string; country: string; type: string }[]> {
    const { offset, limit, country, type } = options;
    const results: { companyId: string; country: string; type: string }[] = [];
    let searchAfter: unknown[] | undefined;
    let skipped = 0;

    while (skipped < offset || results.length < limit) {
      const { urls, nextSearchAfter } =
        await this.getIndexedUrlsPaginatedWithSearchAfter({
          country,
          type,
          size: OrgChartEsService.SEARCH_AFTER_CHUNK_SIZE,
          searchAfter,
        });

      if (urls.length === 0) break;

      searchAfter = nextSearchAfter ?? undefined;

      for (const u of urls) {
        if (skipped < offset) {
          skipped++;
        } else if (results.length < limit) {
          results.push(u);
        }
      }

      if (!nextSearchAfter || urls.length < OrgChartEsService.SEARCH_AFTER_CHUNK_SIZE) {
        break;
      }
    }

    return results;
  }

  /**
   * Get distinct (country, type) pairs with doc counts for Phase 2 sitemaps.
   * Excludes global/fullcompany and type '0'. Sorted by doc count desc.
   */
  async getDistinctCountryTypePairs(): Promise<
    { country: string; type: string; docCount: number }[]
  > {
    if (!this.client) {
      return [];
    }

    const excludeIds = Array.from(
      OrgChartEsService.SITEMAP_EXCLUDED_COMPANY_IDS,
    );

    try {
      const response = await this.client.search({
        index: this.orgChartsIndex,
        size: 0,
        query: {
          bool: {
            must_not: [
              { term: { type: '0' } },
              {
                bool: {
                  must: [
                    { term: { country: 'global' } },
                    { term: { type: 'fullcompany' } },
                  ],
                },
              },
              ...excludeIds.map((id) => ({ term: { job_company_id: id } })),
            ],
          },
        },
        aggs: {
          by_country_type: {
            composite: {
              size: 10000,
              sources: [
                { country: { terms: { field: 'country' } } },
                { type: { terms: { field: 'type' } } },
              ],
            },
          },
        },
      });

      const agg = response.aggregations?.by_country_type as
        | {
            buckets?: Array<{
              key: { country: string; type: string };
              doc_count: number;
            }>;
          }
        | undefined;
      const buckets = agg?.buckets ?? [];
      const pairs = buckets
        .map((b) => ({
          country: b.key?.country ?? 'global',
          type: b.key?.type ?? 'fullcompany',
          docCount: b.doc_count ?? 0,
        }))
        .filter((p) => p.docCount > 0)
        .sort((a, b) => b.docCount - a.docCount);

      return pairs;
    } catch (error) {
      this.logger.error(
        'Elasticsearch getDistinctCountryTypePairs failed',
        error as Error,
      );
      return [];
    }
  }

  /**
   * Get sitemap batch params for a given batchIndex.
   * Phase 1: global fullcompany. Phase 2: country/type slices.
   */
  async getSitemapBatchParams(batchIndex: number): Promise<{
    country: string;
    type: string;
    offset: number;
    limit: number;
  } | null> {
    const count = await this.getGlobalFullcompanyCount();
    const cutoff = OrgChartEsService.computeCutoffForCount(count);

    if (batchIndex < cutoff) {
      const { offset, limit } =
        OrgChartEsService.getOffsetAndLimitForBatch(batchIndex);
      return {
        country: 'global',
        type: 'fullcompany',
        offset,
        limit,
      };
    }

    const pairs = await this.getDistinctCountryTypePairs();
    const PHASE2_SITEMAP_SIZE = 50000;
    let remainingBatchIndex = batchIndex - cutoff;

    for (const pair of pairs) {
      const numSitemaps = Math.ceil(pair.docCount / PHASE2_SITEMAP_SIZE);
      if (remainingBatchIndex < numSitemaps) {
        const offset = remainingBatchIndex * PHASE2_SITEMAP_SIZE;
        const limit = Math.min(
          PHASE2_SITEMAP_SIZE,
          pair.docCount - offset,
        );
        return {
          country: pair.country,
          type: pair.type,
          offset,
          limit,
        };
      }
      remainingBatchIndex -= numSitemaps;
    }

    return null;
  }

  /**
   * Get total count of global fullcompany org chart URLs for sitemap cutoff.
   */
  async getGlobalFullcompanyCount(): Promise<number> {
    if (!this.client) {
      return 0;
    }

    const excludeIds = Array.from(
      OrgChartEsService.SITEMAP_EXCLUDED_COMPANY_IDS,
    );

    try {
      const response = await this.client.count({
        index: this.orgChartsIndex,
        query: {
          bool: {
            must: [
              { term: { country: 'global' } },
              { term: { type: 'fullcompany' } },
            ],
            must_not: [
              { term: { type: '0' } },
              ...excludeIds.map((id) => ({ term: { job_company_id: id } })),
            ],
          },
        },
      });
      return response.count ?? 0;
    } catch (error) {
      this.logger.error(
        'Elasticsearch getGlobalFullcompanyCount failed',
        error as Error,
      );
      return 0;
    }
  }

  /**
   * Get paginated (companyId, country, type) tuples for sitemap indexing.
   * Ordered by count_org descending (largest companies first).
   * Excludes type '0' and SITEMAP_EXCLUDED_COMPANY_IDS.
   * Note: ES index.max_result_window may need to be increased for large offsets
   * (e.g. 100000+) when using deep pagination.
   */
  async getIndexedUrlsPaginated(
    offset: number,
    limit: number,
  ): Promise<{ companyId: string; country: string; type: string }[]> {
    if (!this.client) {
      return [];
    }

    const excludeIds = Array.from(
      OrgChartEsService.SITEMAP_EXCLUDED_COMPANY_IDS,
    );

    try {
      const response = await this.client.search({
        index: this.orgChartsIndex,
        from: offset,
        size: Math.min(limit, 50000),
        _source: ['job_company_id', 'country', 'type'],
        query: {
          bool: {
            must_not: [
              { term: { type: '0' } },
              ...excludeIds.map((id) => ({ term: { job_company_id: id } })),
            ],
          },
        },
        sort: [
          { count_org: { order: 'desc' } },
          { job_company_id: { order: 'asc' } },
          { country: { order: 'asc' } },
          { type: { order: 'asc' } },
        ],
      });

      const hits = response.hits.hits;
      const results: { companyId: string; country: string; type: string }[] = [];
      for (const hit of hits) {
        const src = hit._source as
          | { job_company_id?: string; country?: string; type?: string }
          | undefined;
        if (!src || typeof src.job_company_id !== 'string') continue;
        const companyId = String(src.job_company_id).trim();
        if (!companyId) continue;
        const country =
          typeof src.country === 'string' && src.country.trim()
            ? src.country.trim()
            : 'global';
        const type =
          typeof src.type === 'string' && src.type.trim()
            ? src.type.trim()
            : 'fullcompany';
        results.push({ companyId, country, type });
      }
      return results;
    } catch (error) {
      this.logger.error(
        'Elasticsearch getIndexedUrlsPaginated failed',
        error as Error,
      );
      return [];
    }
  }

  /** Letters for company list browsing (a-z). */
  private static readonly COMPANY_LIST_LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

  /**
   * Get top N company IDs by global rank (count_org desc).
   * Used for maxExposedCount filtering.
   */
  async getTopCompanyIdsByRank(limit: number): Promise<string[]> {
    if (!this.client || limit < 1) {
      return [];
    }

    const excludeIds = Array.from(
      OrgChartEsService.SITEMAP_EXCLUDED_COMPANY_IDS,
    );

    try {
      const response = await this.client.search({
        index: this.orgChartsIndex,
        size: 0,
        query: {
          bool: {
            must_not: [
              { term: { type: '0' } },
              ...excludeIds.map((id) => ({ term: { job_company_id: id } })),
            ],
          },
        },
        aggs: {
          companies: {
            terms: {
              field: 'job_company_id',
              size: Math.min(limit, 10000),
              order: { max_count_org: 'desc' },
            },
            aggs: {
              max_count_org: { max: { field: 'count_org' } },
            },
          },
        },
      });

      const buckets = (response.aggregations?.companies as { buckets?: Array<{ key: string }> })
        ?.buckets ?? [];
      return buckets
        .map((b) => b.key)
        .filter(
          (id): id is string =>
            !!id && !OrgChartEsService.SITEMAP_EXCLUDED_COMPANY_IDS.has(id),
        );
    } catch (error) {
      this.logger.error(
        'Elasticsearch getTopCompanyIdsByRank failed',
        error as Error,
      );
      return [];
    }
  }

  /**
   * Get companies for the /companies/{letter}-{page} list.
   * Returns company IDs starting with the given letter, ordered by max count_org desc.
   */
  async getCompaniesByLetterPage(
    letter: string,
    page: number,
    pageSize = 100,
    maxExposedCount?: number,
  ): Promise<{ companyIds: string[]; hasMore: boolean }> {
    if (!this.client) {
      return { companyIds: [], hasMore: false };
    }

    const normalizedLetter = letter.toLowerCase().trim();
    if (normalizedLetter.length !== 1 || !/[a-z]/.test(normalizedLetter)) {
      return { companyIds: [], hasMore: false };
    }

    const excludeIds = Array.from(
      OrgChartEsService.SITEMAP_EXCLUDED_COMPANY_IDS,
    );
    const from = (Math.max(1, page) - 1) * pageSize;

    let topCompanyIds: string[] | undefined;
    if (maxExposedCount != null && maxExposedCount > 0 && maxExposedCount <= 10000) {
      topCompanyIds = await this.getTopCompanyIdsByRank(maxExposedCount);
    }

    const mustClauses: Record<string, unknown>[] = [
      { prefix: { job_company_id: normalizedLetter } },
    ];
    if (topCompanyIds && topCompanyIds.length > 0) {
      mustClauses.push({ terms: { job_company_id: topCompanyIds } });
    }

    try {
      const response = await this.client.search({
        index: this.orgChartsIndex,
        size: 0,
        query: {
          bool: {
            must_not: [
              { term: { type: '0' } },
              ...excludeIds.map((id) => ({ term: { job_company_id: id } })),
            ],
            must: mustClauses,
          },
        },
        aggs: {
          companies: {
            terms: {
              field: 'job_company_id',
              size: 50000,
              order: { max_count_org: 'desc' },
            },
            aggs: {
              max_count_org: {
                max: { field: 'count_org' },
              },
              page_bucket: {
                bucket_sort: {
                  from,
                  size: pageSize + 1,
                },
              },
            },
          },
        },
      });

      const buckets = (response.aggregations?.companies as { buckets?: Array<{ key: string }> })
        ?.buckets ?? [];
      const companyIds = buckets
        .map((b) => b.key)
        .filter((id): id is string => !!id && typeof id === 'string')
        .slice(0, pageSize);
      const hasMore = buckets.length > pageSize;

      return { companyIds, hasMore };
    } catch (error) {
      this.logger.error(
        `Elasticsearch getCompaniesByLetterPage failed letter=${letter}`,
        error as Error,
      );
      return { companyIds: [], hasMore: false };
    }
  }

  /**
   * Get companies for /companies/{country} browse.
   * Returns company IDs with org charts in that country, ordered by count_org desc.
   */
  async getCompaniesByCountryPage(
    country: string,
    page: number,
    pageSize = 100,
    maxExposedCount?: number,
  ): Promise<{ companyIds: string[]; hasMore: boolean }> {
    if (!this.client) {
      return { companyIds: [], hasMore: false };
    }

    const normalizedCountry = country?.trim();
    if (!normalizedCountry) {
      return { companyIds: [], hasMore: false };
    }

    const excludeIds = Array.from(
      OrgChartEsService.SITEMAP_EXCLUDED_COMPANY_IDS,
    );
    const from = (Math.max(1, page) - 1) * pageSize;

    let topCompanyIds: string[] | undefined;
    if (maxExposedCount != null && maxExposedCount > 0 && maxExposedCount <= 10000) {
      topCompanyIds = await this.getTopCompanyIdsByRank(maxExposedCount);
    }

    const mustClauses: Record<string, unknown>[] = [
      { term: { country: normalizedCountry } },
    ];
    if (topCompanyIds && topCompanyIds.length > 0) {
      mustClauses.push({ terms: { job_company_id: topCompanyIds } });
    }

    try {
      const response = await this.client.search({
        index: this.orgChartsIndex,
        size: 0,
        query: {
          bool: {
            must_not: [
              { term: { type: '0' } },
              ...excludeIds.map((id) => ({ term: { job_company_id: id } })),
            ],
            must: mustClauses,
          },
        },
        aggs: {
          companies: {
            terms: {
              field: 'job_company_id',
              size: 50000,
              order: { _key: 'asc' },
            },
            aggs: {
              page_bucket: {
                bucket_sort: {
                  from,
                  size: pageSize + 1,
                },
              },
            },
          },
        },
      });

      const buckets = (response.aggregations?.companies as { buckets?: Array<{ key: string }> })
        ?.buckets ?? [];
      const companyIds = buckets
        .map((b) => b.key)
        .filter((id): id is string => !!id && typeof id === 'string')
        .slice(0, pageSize);
      const hasMore = buckets.length > pageSize;

      return { companyIds, hasMore };
    } catch (error) {
      this.logger.error(
        `Elasticsearch getCompaniesByCountryPage failed country=${country}`,
        error as Error,
      );
      return { companyIds: [], hasMore: false };
    }
  }

  /**
   * Get companies for /companies/{country}/{functionRoot} browse.
   */
  async getCompaniesByCountryAndTypePage(
    country: string,
    type: string,
    page: number,
    pageSize = 100,
    maxExposedCount?: number,
  ): Promise<{ companyIds: string[]; hasMore: boolean }> {
    if (!this.client) {
      return { companyIds: [], hasMore: false };
    }

    const normalizedCountry = country?.trim();
    const normalizedType = type?.trim();
    if (!normalizedCountry || !normalizedType) {
      return { companyIds: [], hasMore: false };
    }

    const excludeIds = Array.from(
      OrgChartEsService.SITEMAP_EXCLUDED_COMPANY_IDS,
    );
    const from = (Math.max(1, page) - 1) * pageSize;

    let topCompanyIds: string[] | undefined;
    if (maxExposedCount != null && maxExposedCount > 0 && maxExposedCount <= 10000) {
      topCompanyIds = await this.getTopCompanyIdsByRank(maxExposedCount);
    }

    const mustClauses: Record<string, unknown>[] = [
      { term: { country: normalizedCountry } },
      { term: { type: normalizedType } },
    ];
    if (topCompanyIds && topCompanyIds.length > 0) {
      mustClauses.push({ terms: { job_company_id: topCompanyIds } });
    }

    try {
      const response = await this.client.search({
        index: this.orgChartsIndex,
        size: 0,
        query: {
          bool: {
            must_not: [
              { term: { type: '0' } },
              ...excludeIds.map((id) => ({ term: { job_company_id: id } })),
            ],
            must: mustClauses,
          },
        },
        aggs: {
          companies: {
            terms: {
              field: 'job_company_id',
              size: 50000,
              order: { _key: 'asc' },
            },
            aggs: {
              page_bucket: {
                bucket_sort: {
                  from,
                  size: pageSize + 1,
                },
              },
            },
          },
        },
      });

      const buckets = (response.aggregations?.companies as { buckets?: Array<{ key: string }> })
        ?.buckets ?? [];
      const companyIds = buckets
        .map((b) => b.key)
        .filter((id): id is string => !!id && typeof id === 'string')
        .slice(0, pageSize);
      const hasMore = buckets.length > pageSize;

      return { companyIds, hasMore };
    } catch (error) {
      this.logger.error(
        `Elasticsearch getCompaniesByCountryAndTypePage failed country=${country} type=${type}`,
        error as Error,
      );
      return { companyIds: [], hasMore: false };
    }
  }

  /**
   * Get (letter, page) tuples for company list URLs to include in sitemap batch.
   * Batch 0: /companies + first page per letter (a-1 through z-1).
   * Batch 1: second page per letter (a-2 through z-2).
   * etc.
   */
  getCompanyListUrlSegmentsForBatch(
    batchIndex: number,
  ): Array<{ letter: string; page: number }> {
    const page = batchIndex + 1;
    return OrgChartEsService.COMPANY_LIST_LETTERS.map((letter) => ({
      letter,
      page,
    }));
  }

  /**
   * Get all (country, type) combinations that exist in ES for a company.
   * Used by the sitemap to index all org chart URL variants.
   */
  async getIndexedUrlsForCompany(
    companyId: string,
  ): Promise<{ country: string; type: string }[]> {
    if (!this.client) {
      return [];
    }

    const normalizedCompanyId = this.normalizeCompanyId(companyId);

    if (!normalizedCompanyId) {
      this.logger.warn('Empty companyId provided to getIndexedUrlsForCompany');
      return [];
    }

    const results: { country: string; type: string }[] = [];
    let after: Record<string, string | number> | undefined;

    try {
      do {
        const compositeAgg: Record<string, unknown> = {
          size: 500,
          sources: [
            { country: { terms: { field: 'country' } } },
            { type: { terms: { field: 'type' } } },
          ],
        };
        if (after) {
          compositeAgg.after = after;
        }

        const response = await this.client.search({
          index: this.orgChartsIndex,
          size: 0,
          query: {
            bool: {
              must: [{ match: { job_company_id: normalizedCompanyId } }],
            },
          },
          aggs: {
            combos: {
              composite: compositeAgg,
            },
          },
        });

        const agg = response.aggregations?.combos as
          | { buckets?: Array<{ key: { country: string; type: string } }>; after?: Record<string, string | number> }
          | undefined;
        const buckets = agg?.buckets ?? [];
        after = agg?.after;

        for (const bucket of buckets) {
          const country = bucket.key?.country ?? 'global';
          const type = bucket.key?.type ?? 'fullcompany';
          // Exclude type '0' - root nodes are not meaningful for sitemap/SEO
          if (type === '0') continue;
          results.push({ country, type });
        }
      } while (after);

      this.logger.log(
        `getIndexedUrlsForCompany companyId=${normalizedCompanyId} found ${results.length} URL combinations`,
      );
      return results;
    } catch (error) {
      this.logger.error(
        `Elasticsearch getIndexedUrlsForCompany failed for companyId=${companyId}`,
        error as Error,
      );
      return [];
    }
  }

  private async searchOrgChartsByWebsiteVariants(
    websiteVariants: string[],
  ): Promise<{
    job_company_id: string;
    job_company_name?: string;
    job_company_website?: string;
    count_org?: number;
  } | null> {
    if (!this.client || websiteVariants.length === 0) {
      return null;
    }

    try {
      const searchResponse = await this.client.search<{
        job_company_id?: string;
        job_company_name?: string;
        job_company_website?: string;
        count_org?: number;
        is_blank_template?: boolean;
      }>({
        index: this.orgChartsIndex,
        size: 5,
        query: {
          bool: {
            must: [
              { terms: { job_company_website: websiteVariants } },
              { term: { type: 'fullcompany' } },
              { term: { country: 'global' } },
            ],
          },
        },
        sort: [{ count_org: { order: 'desc', unmapped_type: 'long' } }],
        _source: [
          'job_company_id',
          'job_company_name',
          'job_company_website',
          'count_org',
          'is_blank_template',
        ],
      });

      for (const hit of searchResponse.hits.hits) {
        const src = hit._source;
        const companyId = src?.job_company_id?.trim().toLowerCase();
        if (!companyId || !isUsableOrgChartEsDocument({ ...src, job_company_id: companyId })) {
          continue;
        }
        return {
          job_company_id: companyId,
          job_company_name:
            typeof src?.job_company_name === 'string'
              ? src.job_company_name
              : undefined,
          job_company_website:
            typeof src?.job_company_website === 'string'
              ? src.job_company_website
              : undefined,
          count_org:
            typeof src?.count_org === 'number' ? src.count_org : undefined,
        };
      }

      return null;
    } catch (error) {
      this.logger.error(
        'Elasticsearch searchOrgChartsByWebsiteVariants failed',
        error as Error,
      );
      return null;
    }
  }

  private async searchCompaniesIndexByWebsiteVariants(
    websiteVariants: string[],
  ): Promise<{ id: string; name?: string; website?: string } | null> {
    if (!this.client || websiteVariants.length === 0) {
      return null;
    }

    const companiesIndex =
      (this.environmentService.get('COMPANIES_ES_INDEX') as string | undefined) ??
      'companies_index_text';

    try {
      const searchResponse = await this.client.search<{
        id?: string;
        name?: string;
        website?: string;
      }>({
        index: companiesIndex,
        size: 5,
        query: {
          bool: {
            should: websiteVariants.map((variant) => ({
              term: { website: variant },
            })),
            minimum_should_match: 1,
          },
        },
        _source: ['id', 'name', 'website'],
      });

      for (const hit of searchResponse.hits.hits) {
        const src = hit._source;
        const id = src?.id?.trim().toLowerCase();
        if (id && isUsableOrgChartResolveCompanyId(id)) {
          return {
            id,
            name: typeof src?.name === 'string' ? src.name : undefined,
            website:
              typeof src?.website === 'string' ? src.website : undefined,
          };
        }
      }

      return null;
    } catch (error) {
      this.logger.error(
        'Elasticsearch searchCompaniesIndexByWebsiteVariants failed',
        error as Error,
      );
      return null;
    }
  }

  async findOrgChartByCompanyId(
    companyId: string,
  ): Promise<OrgChartEsDomainResolveHit | null> {
    if (!this.client) {
      return null;
    }

    const normalizedCompanyId = this.normalizeCompanyId(companyId);
    if (!normalizedCompanyId) {
      return null;
    }

    try {
      const searchResponse = await this.client.search<{
        job_company_id?: string;
        job_company_name?: string;
        job_company_website?: string;
        count_org?: number;
        is_blank_template?: boolean;
      }>({
        index: this.orgChartsIndex,
        size: 1,
        query: {
          bool: {
            must: [
              { term: { job_company_id: normalizedCompanyId } },
              { term: { type: 'fullcompany' } },
              { term: { country: 'global' } },
            ],
          },
        },
        _source: [
          'job_company_id',
          'job_company_name',
          'job_company_website',
          'count_org',
          'is_blank_template',
        ],
      });

      const src = searchResponse.hits.hits[0]?._source;
      const resolvedId = src?.job_company_id?.trim().toLowerCase();
      if (!resolvedId || !isUsableOrgChartEsDocument({ ...src, job_company_id: resolvedId })) {
        return null;
      }

      return {
        companyId: resolvedId,
        companyName:
          typeof src?.job_company_name === 'string'
            ? src.job_company_name
            : undefined,
        website:
          typeof src?.job_company_website === 'string'
            ? src.job_company_website
            : undefined,
        source: 'orgcharts',
        hasOrgChart: true,
        countOrg:
          typeof src?.count_org === 'number' ? src.count_org : undefined,
      };
    } catch (error) {
      this.logger.error(
        `Elasticsearch findOrgChartByCompanyId failed for companyId=${companyId}`,
        error as Error,
      );
      return null;
    }
  }

  async resolveCompanyByDomain(
    bareDomain: string,
  ): Promise<OrgChartEsDomainResolveHit | null> {
    const websiteVariants = buildCompanyWebsiteLookupVariants(bareDomain);
    if (websiteVariants.length === 0) {
      return null;
    }

    this.logger.log(
      `resolveCompanyByDomain bareDomain=${bareDomain} variants=${websiteVariants.length}`,
    );

    const orgHit = await this.searchOrgChartsByWebsiteVariants(websiteVariants);
    if (orgHit) {
      return {
        companyId: orgHit.job_company_id,
        companyName: orgHit.job_company_name,
        website: orgHit.job_company_website ?? bareDomain,
        source: 'orgcharts',
        hasOrgChart: true,
        countOrg: orgHit.count_org,
      };
    }

    const companyHit =
      await this.searchCompaniesIndexByWebsiteVariants(websiteVariants);
    if (companyHit) {
      return {
        companyId: companyHit.id,
        companyName: companyHit.name,
        website: companyHit.website ?? bareDomain,
        source: 'companies',
        hasOrgChart: false,
      };
    }

    return null;
  }
}
