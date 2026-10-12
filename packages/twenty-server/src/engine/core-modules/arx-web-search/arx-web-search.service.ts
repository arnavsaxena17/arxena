import { Injectable, Logger } from '@nestjs/common';

import { PerplexitySearchService } from 'src/engine/core-modules/arx-web-search/perplexity-search.service';
import { BrightDataSerpService } from 'src/engine/core-modules/bright-data/services/bright-data-serp.service';
import {
  buildSerpEvidence,
  type ArxWebSearchEvidence,
} from 'src/engine/core-modules/arx-web-search/utils/extract-serp-evidence.util';

// Bright Data pay-as-you-go SERP price per request; override with
// ARX_WEB_SEARCH_SERP_COST_USD when the contract rate differs.
const DEFAULT_SERP_COST_USD = 0.0015;
const SERP_ATTEMPTS = 3;
const SERP_RETRY_DELAY_MS = 1_500;

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

// Cheap web lookup reduced to a compact evidence block that the caller turns
// into structured data with a small model, far cheaper than a model-driven web
// search tool. Perplexity Search API is the provider: in a 60-company eval it
// was 95.6% accurate in 2-3s, while Google SERP via Bright Data was 74.2% with
// a 28s median. The Bright Data SERP stays as an opt-in second provider
// (ARX_WEB_SEARCH_BRIGHT_DATA_FALLBACK=true).
@Injectable()
export class ArxWebSearchService {
  private readonly logger = new Logger(ArxWebSearchService.name);

  constructor(
    private readonly perplexitySearchService: PerplexitySearchService,
    private readonly brightDataSerpService: BrightDataSerpService,
  ) {}

  get serpCostUsd(): number {
    const configured = Number(process.env.ARX_WEB_SEARCH_SERP_COST_USD);

    return Number.isFinite(configured) && configured > 0
      ? configured
      : DEFAULT_SERP_COST_USD;
  }

  private get brightDataFallbackEnabled(): boolean {
    return (
      process.env.ARX_WEB_SEARCH_BRIGHT_DATA_FALLBACK === 'true' &&
      this.brightDataSerpService.isConfigured()
    );
  }

  isAvailable(): boolean {
    return (
      process.env.ARX_WEB_SEARCH_ENABLED !== 'false' &&
      (this.perplexitySearchService.isConfigured() ||
        this.brightDataFallbackEnabled)
    );
  }

  // Perplexity Sonar answers with web search and structured JSON in one call.
  isStructuredAvailable(): boolean {
    return (
      process.env.ARX_WEB_SEARCH_ENABLED !== 'false' &&
      this.perplexitySearchService.isConfigured()
    );
  }

  // The "serp" step of the provider chain: Google SERP alone, on whenever
  // Bright Data is configured (the chain order is the opt-in, so the older
  // ARX_WEB_SEARCH_BRIGHT_DATA_FALLBACK flag is not needed).
  isSerpAvailable(): boolean {
    return (
      process.env.ARX_WEB_SEARCH_ENABLED !== 'false' &&
      this.brightDataSerpService.isConfigured()
    );
  }

  get sonarBacklogMs(): number {
    return this.perplexitySearchService.sonarBacklogMs;
  }

  completeStructured(
    input: Parameters<PerplexitySearchService['completeStructured']>[0],
  ) {
    return this.perplexitySearchService.completeStructured(input);
  }

  // Google shows an AI Overview on a minority of queries (0 of 4 in testing)
  // and requesting it made Bright Data's session setup flakier, so it is
  // opt-in with ARX_WEB_SEARCH_AI_OVERVIEW=true.
  private buildSearchUrl(query: string): string {
    const params = new URLSearchParams({
      q: query,
      brd_json: '1',
      hl: 'en',
      gl: 'us',
    });

    if (process.env.ARX_WEB_SEARCH_AI_OVERVIEW === 'true') {
      params.set('brd_ai_overview', '2');
    }

    return `https://www.google.com/search?${params.toString()}`;
  }

  // Returns null when no provider gave anything usable, so the caller can fall
  // back to a model-driven web search.
  // serpOnly skips the Perplexity snippets and the legacy fallback flag, for the
  // chain's "serp" step where Perplexity has already been tried or skipped.
  async search(
    query: string,
    { serpOnly = false }: { serpOnly?: boolean } = {},
  ): Promise<ArxWebSearchEvidence | null> {
    const trimmed = query.trim();

    if (serpOnly) {
      return trimmed === '' || !this.isSerpAvailable()
        ? null
        : this.searchGoogleSerp(trimmed, true);
    }

    if (trimmed === '' || !this.isAvailable()) {
      return null;
    }

    return (
      (await this.perplexitySearchService.search(trimmed)) ??
      (await this.searchGoogleSerp(trimmed))
    );
  }

  private async searchGoogleSerp(
    trimmed: string,
    ignoreFallbackFlag = false,
  ): Promise<ArxWebSearchEvidence | null> {
    if (!ignoreFallbackFlag && !this.brightDataFallbackEnabled) {
      return null;
    }

    for (let attempt = 1; attempt <= SERP_ATTEMPTS; attempt++) {
      try {
        const serp = await this.brightDataSerpService.requestSerpGoogleJson(
          this.buildSearchUrl(trimmed),
        );
        const evidence = buildSerpEvidence(trimmed, serp, this.serpCostUsd);

        if (evidence !== null) {
          return evidence;
        }
      } catch (error) {
        this.logger.warn(
          `SERP attempt ${attempt}/${SERP_ATTEMPTS} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Bright Data answers "no ready cookies" 502s now and then; a retry
      // is billed only when it succeeds.
      if (attempt < SERP_ATTEMPTS) {
        await sleep(SERP_RETRY_DELAY_MS * attempt);
      }
    }

    return null;
  }
}
