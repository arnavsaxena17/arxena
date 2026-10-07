import { Injectable, Logger } from '@nestjs/common';

import { BRIGHT_DATA_LUDICROUS_MAX_RETRIES } from 'src/engine/core-modules/bright-data/ludicrous/constants/bright-data-ludicrous-pricing.const';
import { type BrightDataLudicrousQuery } from 'src/engine/core-modules/bright-data/ludicrous/types/bright-data-ludicrous.types';
import { assertValidLudicrousQuery } from 'src/engine/core-modules/bright-data/ludicrous/utils/bright-data-ludicrous-query.util';
import { costForRecordsUsd } from 'src/engine/core-modules/bright-data/ludicrous/utils/bright-data-ludicrous-pricing.util';
import {
  BRIGHT_DATA_BUSINESS_SEARCH_MAX_QUERY_LENGTH,
  normalizeBrightDataBusinessSearchMode,
  planBrightDataBusinessSearchPages,
  type BrightDataBusinessSearchDocument,
  type BrightDataBusinessSearchEntity,
  type BrightDataBusinessSearchMode,
  type BrightDataBusinessSearchView,
} from 'src/engine/core-modules/bright-data/utils/bright-data-business-search.util';

const BRIGHT_DATA_SEARCH_URL = 'https://api.brightdata.com/search';
const RETRY_BASE_DELAY_MS = 500;

export type BrightDataBusinessSearchInput = {
  entity: BrightDataBusinessSearchEntity;
  mode?: string;
  // Natural-language string for smart/instant, structured object for ludicrous
  query: string | BrightDataLudicrousQuery;
  limit?: number;
  offset?: number;
  view?: BrightDataBusinessSearchView;
  // Ludicrous only: request just these fields instead of a named view
  fields?: string[];
};

export type BrightDataBusinessSearchResult = {
  reqId: string;
  matched: number;
  coveragePercent: number;
  mode: BrightDataBusinessSearchMode;
  documents: BrightDataBusinessSearchDocument[];
  // Bright Data bills per returned record
  costUsd: number;
};

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
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class BrightDataBusinessSearchService {
  private readonly logger = new Logger(BrightDataBusinessSearchService.name);

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
    const pages = planBrightDataBusinessSearchPages({
      mode,
      limit: input.limit,
      offset: input.offset,
    });
    const documents: BrightDataBusinessSearchDocument[] = [];
    let reqId = '';
    let matched = 0;
    let coveragePercent = 100;

    for (const page of pages) {
      const response = await this.fetchPage({
        apiKey: key,
        entity: input.entity,
        mode,
        query,
        offset: page.offset,
        limit: page.limit,
        view: input.view ?? 'full',
        fields: input.fields,
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
    fields,
  }: {
    entity: BrightDataBusinessSearchEntity;
    query: BrightDataLudicrousQuery;
    offset: number;
    limit: number;
    fields?: string[];
  }): Promise<BrightDataBusinessSearchResult> {
    const key = this.apiKey;

    if (!key) {
      throw new Error('BRIGHT_DATA_API_KEY is not set');
    }

    const validated = assertValidLudicrousQuery({ entity, query });
    const response = await this.fetchPage({
      apiKey: key,
      entity,
      mode: 'ludicrous',
      query: validated,
      offset,
      limit,
      view: 'full',
      fields,
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
    view,
    fields,
  }: {
    apiKey: string;
    entity: BrightDataBusinessSearchEntity;
    mode: BrightDataBusinessSearchMode;
    query: string | BrightDataLudicrousQuery;
    offset: number;
    limit: number;
    view: BrightDataBusinessSearchView;
    fields?: string[];
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
      view: mode === 'ludicrous' && fields?.length ? { fields } : view,
    };

    // smart and instant still require the legacy source discriminator
    if (mode !== 'ludicrous') {
      body.source =
        entity === 'company' ? 'linkedin_company' : 'linkedin_people';
    }

    let lastError: unknown;

    for (
      let attempt = 0;
      attempt <= BRIGHT_DATA_LUDICROUS_MAX_RETRIES;
      attempt++
    ) {
      try {
        const page = await this.postOnce({ apiKey, entity, body });

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

        await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
      }
    }

    throw lastError;
  }

  private async postOnce({
    apiKey,
    entity,
    body,
  }: {
    apiKey: string;
    entity: BrightDataBusinessSearchEntity;
    body: Record<string, unknown>;
  }): Promise<BrightDataSearchPage> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

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
        );
      }

      return JSON.parse(rawText) as BrightDataSearchPage;
    } finally {
      clearTimeout(timeout);
    }
  }
}
