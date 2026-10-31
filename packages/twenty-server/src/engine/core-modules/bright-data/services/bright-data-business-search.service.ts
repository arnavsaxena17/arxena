import { Injectable, Logger, Optional } from '@nestjs/common';

import {
  BrightDataRequestRateLimiter,
  parseRetryAfterMs,
} from 'src/engine/core-modules/bright-data/utils/bright-data-request-rate-limiter.util';
import { BRIGHT_DATA_LUDICROUS_MAX_RETRIES } from 'src/engine/core-modules/bright-data/ludicrous/constants/bright-data-ludicrous-pricing.const';
import { type BrightDataLudicrousQuery } from 'src/engine/core-modules/bright-data/ludicrous/types/bright-data-ludicrous.types';
import {
  assertValidLudicrousQuery,
  canonicalizeLudicrousQuery,
} from 'src/engine/core-modules/bright-data/ludicrous/utils/bright-data-ludicrous-query.util';
import {
  ProviderCallLogService,
  trackProviderCall,
} from 'src/engine/core-modules/provider-call-log/services/provider-call-log.service';
import { ProviderQueryCacheService } from 'src/engine/core-modules/cache-storage/services/provider-query-cache.service';
import { buildProviderQueryCacheKey } from 'src/engine/core-modules/cache-storage/utils/provider-query-cache-key.util';
import { RawFetchArchiveService } from 'src/engine/core-modules/raw-fetch-archive/raw-fetch-archive.service';
import { costForRecordsUsd } from 'src/engine/core-modules/bright-data/ludicrous/utils/bright-data-ludicrous-pricing.util';
import {
  BRIGHT_DATA_BUSINESS_SEARCH_MAX_QUERY_LENGTH,
  normalizeBrightDataBusinessSearchMode,
  planBrightDataBusinessSearchPages,
  type BrightDataBusinessSearchDocument,
  type BrightDataBusinessSearchEntity,
  type BrightDataBusinessSearchMode,
} from 'src/engine/core-modules/bright-data/utils/bright-data-business-search.util';

const BRIGHT_DATA_SEARCH_CACHE_PREFIX = 'bright-data-search:v1';
const BRIGHT_DATA_SEARCH_PAGE_CACHE_PREFIX = 'bright-data-search-page:v1';

const BRIGHT_DATA_SEARCH_URL = 'https://api.brightdata.com/search';
const RETRY_BASE_DELAY_MS = 500;
// Bright Data allows 60 requests a minute per account, category (people or
// company) and mode, refilled continuously; a request over it is rejected with
// a 429, not queued and not billed. Stay a little under it.
const DEFAULT_REQUESTS_PER_MINUTE = 55;

const readRequestsPerMinute = (): number => {
  const configured = Number(
    process.env.BRIGHT_DATA_BUSINESS_SEARCH_REQUESTS_PER_MINUTE,
  );

  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_REQUESTS_PER_MINUTE;
};

// One limiter per category and mode for the whole process, so every caller
// (fetch_profiles, find_people_by_company, the ludicrous planner) shares one budget
const rateLimiters = new Map<string, BrightDataRequestRateLimiter>();

const rateLimiterFor = (
  entity: string,
  mode: string,
): BrightDataRequestRateLimiter => {
  const key = `${entity}:${mode}`;
  const existing = rateLimiters.get(key);

  if (existing !== undefined) {
    return existing;
  }

  const created = new BrightDataRequestRateLimiter(readRequestsPerMinute);

  rateLimiters.set(key, created);

  return created;
};

export type BrightDataBusinessSearchInput = {
  entity: BrightDataBusinessSearchEntity;
  mode?: string;
  // Natural-language string for smart/instant, structured object for ludicrous
  query: string | BrightDataLudicrousQuery;
  limit?: number;
  offset?: number;
  // Scopes the raw-response archive to the workspace that paid for the call
  workspaceId?: string;
};

export type BrightDataBusinessSearchResult = {
  reqId: string;
  matched: number;
  coveragePercent: number;
  mode: BrightDataBusinessSearchMode;
  documents: BrightDataBusinessSearchDocument[];
  // Bright Data bills per returned record
  costUsd: number;
  // True when this answer was replayed from ProviderQueryCacheService: no
  // provider request was made, so a caller that bills per record must not
  // charge for it again
  fromCache: boolean;
};

type BrightDataSearchResponse = Omit<
  BrightDataBusinessSearchResult,
  'fromCache'
>;

type BrightDataSearchPage = {
  req_id?: string;
  meta?: { matched?: number; coverage_percent?: number };
  documents?: Array<{
    bright_id?: string;
    data?: Record<string, unknown>;
  }>;
};

export class BrightDataBusinessSearchHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    // From the Retry-After header of a 429
    readonly retryAfterMs?: number,
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class BrightDataBusinessSearchService {
  private readonly logger = new Logger(BrightDataBusinessSearchService.name);

  constructor(
    @Optional()
    private readonly rawFetchArchiveService?: RawFetchArchiveService,
    @Optional()
    private readonly providerQueryCache?: ProviderQueryCacheService,
    @Optional()
    private readonly providerCallLog?: ProviderCallLogService,
  ) {}

  private get apiKey(): string | undefined {
    return process.env.BRIGHT_DATA_API_KEY?.trim() || undefined;
  }

  private get requestTimeoutMs(): number {
    return Number(process.env.BRIGHT_DATA_BUSINESS_SEARCH_TIMEOUT_MS ?? 60_000);
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async search(
    input: BrightDataBusinessSearchInput,
  ): Promise<BrightDataBusinessSearchResult> {
    const key = this.apiKey;

    if (!key) {
      throw new Error('BRIGHT_DATA_API_KEY is not set');
    }

    const mode = normalizeBrightDataBusinessSearchMode(input.mode);
    const query = this.prepareQuery(input, mode);
    // Planned once: an omitted limit takes the mode's page size, so two callers
    // that end up asking for the same window must share one paid answer
    const pages = planBrightDataBusinessSearchPages({
      mode,
      limit: input.limit,
      offset: input.offset,
    });

    if (!this.providerQueryCache) {
      return {
        ...(await this.searchUncached(key, input, mode, query, pages)),
        fromCache: false,
      };
    }

    const parts = {
      entity: input.entity,
      mode,
      query,
      offset: Math.max(0, input.offset ?? 0),
      limit: pages.reduce((total, page) => total + page.limit, 0),
    };
    const keyParts = this.cacheKeyParts(parts);
    const cacheKey = buildProviderQueryCacheKey(
      BRIGHT_DATA_SEARCH_CACHE_PREFIX,
      keyParts,
    );
    // The cache entry covers the whole window, so it names one request only
    // when that window is a single page
    const windowCacheKey = pages.length === 1 ? cacheKey : undefined;
    let fetched = false;

    // workspaceId scopes archival only; same query is the same paid answer
    const response =
      await this.providerQueryCache.getOrFetch<BrightDataSearchResponse>(
        BRIGHT_DATA_SEARCH_CACHE_PREFIX,
        parts,
        () => {
          fetched = true;

          return this.searchUncached(
            key,
            input,
            mode,
            query,
            pages,
            windowCacheKey,
          );
        },
        { keyParts, fetcherLogsRequest: true },
      );

    return { ...response, fromCache: !fetched };
  }

  // The key must describe the request Bright Data receives, or one paid answer
  // is bought again under a second key. The request always asks for view
  // "full", so nothing else may vary; the ordered parts are canonical, because
  // and/or branches and in-lists are sets.
  private cacheKeyParts<
    TParts extends { query: string | BrightDataLudicrousQuery },
  >(
    parts: TParts,
  ): Omit<TParts, 'query'> & {
    query: string | BrightDataLudicrousQuery;
  } {
    return {
      ...parts,
      query:
        typeof parts.query === 'string'
          ? parts.query
          : canonicalizeLudicrousQuery(parts.query),
    };
  }

  private async searchUncached(
    apiKey: string,
    input: BrightDataBusinessSearchInput,
    mode: BrightDataBusinessSearchMode,
    query: string | BrightDataLudicrousQuery,
    pages: Array<{ offset: number; limit: number }>,
    pageCacheKey?: string,
  ): Promise<BrightDataSearchResponse> {
    const documents: BrightDataBusinessSearchDocument[] = [];
    let reqId = '';
    let matched = 0;
    let coveragePercent = 100;

    for (const page of pages) {
      const response = await this.fetchPage({
        apiKey,
        entity: input.entity,
        mode,
        query,
        offset: page.offset,
        limit: page.limit,
        workspaceId: input.workspaceId,
        cacheKey: pageCacheKey,
      });

      reqId = response.reqId || reqId;
      matched = response.matched ?? matched;
      coveragePercent = response.coveragePercent;
      documents.push(...response.documents);

      if (response.documents.length < page.limit) {
        break;
      }

      if (matched > 0 && page.offset + response.documents.length >= matched) {
        break;
      }
    }

    return {
      reqId,
      matched,
      coveragePercent,
      mode,
      documents,
      costUsd: costForRecordsUsd(documents.length),
    };
  }

  // One billable request. Used by the budgeted executor, which decides after
  // every page whether the next one is still worth paying for.
  async searchPage({
    entity,
    query,
    offset,
    limit,
    workspaceId,
  }: {
    entity: BrightDataBusinessSearchEntity;
    query: BrightDataLudicrousQuery;
    offset: number;
    limit: number;
    workspaceId?: string;
  }): Promise<BrightDataBusinessSearchResult> {
    const key = this.apiKey;

    if (!key) {
      throw new Error('BRIGHT_DATA_API_KEY is not set');
    }

    const validated = assertValidLudicrousQuery({ entity, query });
    const parts = { entity, query: validated, offset, limit };
    const runPage = (cacheKey?: string) =>
      this.searchPageUncached({
        apiKey: key,
        entity,
        query: validated,
        offset,
        limit,
        workspaceId,
        cacheKey,
      });

    if (!this.providerQueryCache) {
      return { ...(await runPage()), fromCache: false };
    }

    const keyParts = this.cacheKeyParts(parts);
    const cacheKey = buildProviderQueryCacheKey(
      BRIGHT_DATA_SEARCH_PAGE_CACHE_PREFIX,
      keyParts,
    );
    let fetched = false;

    const response =
      await this.providerQueryCache.getOrFetch<BrightDataSearchResponse>(
        BRIGHT_DATA_SEARCH_PAGE_CACHE_PREFIX,
        parts,
        () => {
          fetched = true;

          return runPage(cacheKey);
        },
        { keyParts, fetcherLogsRequest: true },
      );

    return { ...response, fromCache: !fetched };
  }

  private async searchPageUncached({
    apiKey,
    entity,
    query,
    offset,
    limit,
    workspaceId,
    cacheKey,
  }: {
    apiKey: string;
    entity: BrightDataBusinessSearchEntity;
    query: BrightDataLudicrousQuery;
    offset: number;
    limit: number;
    workspaceId?: string;
    cacheKey?: string;
  }): Promise<BrightDataSearchResponse> {
    const response = await this.fetchPage({
      apiKey,
      entity,
      mode: 'ludicrous',
      query,
      offset,
      limit,
      workspaceId,
      cacheKey,
    });

    return {
      reqId: response.reqId,
      matched: response.matched ?? 0,
      coveragePercent: response.coveragePercent,
      mode: 'ludicrous',
      documents: response.documents,
      costUsd: costForRecordsUsd(response.documents.length),
    };
  }

  private prepareQuery(
    input: BrightDataBusinessSearchInput,
    mode: BrightDataBusinessSearchMode,
  ): string | BrightDataLudicrousQuery {
    if (mode === 'ludicrous') {
      if (typeof input.query === 'string') {
        throw new Error(
          'Ludicrous mode needs a structured query object; plan natural language through BrightDataLudicrousSearchService',
        );
      }

      return assertValidLudicrousQuery({
        entity: input.entity,
        query: input.query,
      });
    }

    if (typeof input.query !== 'string') {
      throw new Error(`${mode} mode needs a natural-language query string`);
    }

    const query = input.query.trim();

    if (!query) {
      throw new Error('query is required');
    }

    if (query.length > BRIGHT_DATA_BUSINESS_SEARCH_MAX_QUERY_LENGTH) {
      throw new Error(
        `query must be at most ${BRIGHT_DATA_BUSINESS_SEARCH_MAX_QUERY_LENGTH} characters`,
      );
    }

    return query;
  }

  private async fetchPage({
    apiKey,
    entity,
    mode,
    query,
    offset,
    limit,
    workspaceId,
    cacheKey,
  }: {
    apiKey: string;
    entity: BrightDataBusinessSearchEntity;
    mode: BrightDataBusinessSearchMode;
    query: string | BrightDataLudicrousQuery;
    offset: number;
    limit: number;
    workspaceId?: string;
    cacheKey?: string;
  }): Promise<{
    reqId: string;
    matched: number | undefined;
    coveragePercent: number;
    documents: BrightDataBusinessSearchDocument[];
  }> {
    const body: Record<string, unknown> = {
      mode,
      query,
      offset,
      limit,
      // Always full: every stored field is kept so rows can be mapped later
      view: 'full',
    };

    // smart and instant still require the legacy source discriminator
    if (mode !== 'ludicrous') {
      body.source =
        entity === 'company' ? 'linkedin_company' : 'linkedin_people';
    }

    const rateLimiter = rateLimiterFor(entity, mode);
    let lastError: unknown;

    for (
      let attempt = 0;
      attempt <= BRIGHT_DATA_LUDICROUS_MAX_RETRIES;
      attempt++
    ) {
      try {
        // Wait for a slot in the shared budget; during a 429 pause this holds
        // every caller, so nobody retries on their own
        await rateLimiter.acquire();

        const page = await this.postOnce({ apiKey, entity, body, cacheKey });

        // Archive the untouched response before any filtering: the records
        // are billed per document the moment this call returns
        await this.rawFetchArchiveService?.archive({
          provider: 'bright-data',
          endpoint: `business-search/${entity}`,
          workspaceId,
          request: body,
          response: page,
          pageKey: offset,
          costUsd: costForRecordsUsd(page.documents?.length ?? 0),
          meta: {
            mode,
            reqId: page.req_id ?? null,
            cacheKey: cacheKey ?? null,
          },
        });

        return {
          reqId: page.req_id ?? '',
          matched:
            typeof page.meta?.matched === 'number'
              ? page.meta.matched
              : undefined,
          coveragePercent:
            typeof page.meta?.coverage_percent === 'number'
              ? page.meta.coverage_percent
              : 100,
          documents: (page.documents ?? [])
            .filter((document) => typeof document.bright_id === 'string')
            .map((document) => ({
              brightId: document.bright_id as string,
              data: document.data ?? {},
            })),
        };
      } catch (error) {
        lastError = error;

        // 4xx means our request is wrong; only 5xx and network blips retry
        const isRetryable =
          !(error instanceof BrightDataBusinessSearchHttpError) ||
          error.status >= 500 ||
          error.status === 429;

        if (!isRetryable || attempt === BRIGHT_DATA_LUDICROUS_MAX_RETRIES) {
          break;
        }

        if (
          error instanceof BrightDataBusinessSearchHttpError &&
          error.status === 429
        ) {
          // Honor Retry-After for everyone; the next attempt re-enters the
          // shared budget, which is slower for a while after a 429
          rateLimiter.pause(error.retryAfterMs);
          continue;
        }

        await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
      }
    }

    throw lastError;
  }

  private async postOnce({
    apiKey,
    entity,
    body,
    cacheKey,
  }: {
    apiKey: string;
    entity: BrightDataBusinessSearchEntity;
    body: Record<string, unknown>;
    cacheKey?: string;
  }): Promise<BrightDataSearchPage> {
    // One ledger row per attempt: a retry is a second request, and a failed
    // attempt is not billed by Bright Data, so it must not be priced
    return trackProviderCall(
      this.providerCallLog,
      {
        provider: 'bright-data',
        operation: `business-search:${entity}`,
        storeResponse: false,
        cacheKey,
        // The query is what identifies the request: without it every shard and
        // page of a ludicrous run logs the same four numbers and the ledger
        // cannot say what was bought
        request: {
          entity,
          mode: body.mode,
          query: body.query,
          limit: body.limit,
          offset: body.offset,
        },
      },
      async () => {
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          this.requestTimeoutMs,
        );

        try {
          const response = await fetch(`${BRIGHT_DATA_SEARCH_URL}/${entity}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
          const rawText = await response.text();

          if (!response.ok) {
            this.logger.warn(
              `Bright Data business search HTTP ${response.status}: ${rawText.slice(0, 500)}`,
            );
            throw new BrightDataBusinessSearchHttpError(
              response.status,
              `Bright Data business search failed (${response.status}): ${rawText.slice(0, 200)}`,
              parseRetryAfterMs(response.headers?.get?.('retry-after')),
            );
          }

          return JSON.parse(rawText) as BrightDataSearchPage;
        } finally {
          clearTimeout(timeout);
        }
      },
    );
  }
}
