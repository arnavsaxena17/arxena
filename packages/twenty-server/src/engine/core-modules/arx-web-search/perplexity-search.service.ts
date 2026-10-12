import { Injectable, Logger } from '@nestjs/common';

import {
  buildEvidence,
  type ArxWebSearchEvidence,
} from 'src/engine/core-modules/arx-web-search/utils/extract-serp-evidence.util';

const PERPLEXITY_SEARCH_URL = 'https://api.perplexity.ai/search';
const REQUEST_TIMEOUT_MS = 20_000;
const PERPLEXITY_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1_000;
const MAX_RESULTS = 6;
// Perplexity Search API list price per request; override with
// ARX_WEB_SEARCH_PERPLEXITY_COST_USD if the contract rate differs.
const DEFAULT_PERPLEXITY_COST_USD = 0.005;
const PERPLEXITY_CHAT_URL = 'https://api.perplexity.ai/chat/completions';
// Sonar answers with live web search inside one call; slower than the ranked
// search API, so it gets a longer timeout.
const SONAR_TIMEOUT_MS = 60_000;
// Sonar rate-limits bursts (429), so it retries with a growing delay.
const SONAR_ATTEMPTS = 5;
const SONAR_RETRY_DELAY_MS = 2_000;
// Sonar allows roughly 50 requests a minute per key. Starting a request at
// most every 1.3s keeps a whole run just under that instead of bouncing off
// 429s; ARX_WEB_SEARCH_SONAR_MIN_INTERVAL_MS overrides it for higher tiers.
const DEFAULT_SONAR_MIN_INTERVAL_MS = 1_300;
const DEFAULT_SONAR_MODEL = 'sonar';
// Fallback when Perplexity does not report a cost: the per-request fee of the
// low search-context tier plus a typical token bill.
const DEFAULT_SONAR_COST_USD = 0.008;

export type PerplexityStructuredCompletion = {
  content: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

type PerplexityChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    cost?: { total_cost?: number };
  };
};

type PerplexitySearchResponse = {
  results?: Array<{
    title?: string;
    url?: string;
    snippet?: string;
    date?: string | null;
  }>;
};

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

// Perplexity Search API: ranked web results with answer-bearing snippets.
@Injectable()
export class PerplexitySearchService {
  private readonly logger = new Logger(PerplexitySearchService.name);
  private nextSonarSlotAt = 0;

  private get apiKey(): string | undefined {
    return process.env.PERPLEXITY_API_KEY?.trim() || undefined;
  }

  get costUsd(): number {
    const configured = Number(process.env.ARX_WEB_SEARCH_PERPLEXITY_COST_USD);

    return Number.isFinite(configured) && configured > 0
      ? configured
      : DEFAULT_PERPLEXITY_COST_USD;
  }

  isConfigured(): boolean {
    return this.apiKey !== undefined;
  }

  // Null on any failure or empty answer so the caller can try the next provider.
  async search(query: string): Promise<ArxWebSearchEvidence | null> {
    const key = this.apiKey;

    if (!key) {
      return null;
    }

    for (let attempt = 1; attempt <= PERPLEXITY_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(PERPLEXITY_SEARCH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            query,
            max_results: MAX_RESULTS,
            // lower-latency, lower-cost web search
            search_type: process.env.ARX_WEB_SEARCH_PERPLEXITY_TYPE || 'fast',
          }),
          signal: controller.signal,
        });

        if (response.ok) {
          const body = (await response.json()) as PerplexitySearchResponse;

          return buildEvidence({
            query,
            provider: 'perplexity',
            costUsd: this.costUsd,
            aiOverview: null,
            snippets: (body.results ?? [])
              .map((result) => ({
                title: (result.title ?? '').trim(),
                url: (result.url ?? '').trim(),
                description: (result.snippet ?? '').trim().slice(0, 600),
              }))
              .filter(
                (snippet) => snippet.title !== '' && snippet.description !== '',
              ),
          });
        }

        this.logger.warn(
          `Perplexity search attempt ${attempt}/${PERPLEXITY_ATTEMPTS}: HTTP ${response.status}`,
        );

        // Bad requests and auth failures never succeed on retry
        if (response.status !== 429 && response.status < 500) {
          return null;
        }
      } catch (error) {
        this.logger.warn(
          `Perplexity search attempt ${attempt}/${PERPLEXITY_ATTEMPTS} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        clearTimeout(timeout);
      }

      if (attempt < PERPLEXITY_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
      }
    }

    return null;
  }

  // How long a Sonar call started now would wait for its pacing slot, so the
  // caller can send the lookup to another provider instead of queueing.
  get sonarBacklogMs(): number {
    return Math.max(0, this.nextSonarSlotAt - Date.now());
  }

  // Hands out request start times at least one interval apart, shared by every
  // concurrent caller in this process.
  private async waitForSonarSlot(): Promise<void> {
    const configured = Number(process.env.ARX_WEB_SEARCH_SONAR_MIN_INTERVAL_MS);
    const interval =
      Number.isFinite(configured) && configured >= 0
        ? configured
        : DEFAULT_SONAR_MIN_INTERVAL_MS;
    const now = Date.now();
    const slot = Math.max(now, this.nextSonarSlotAt);

    this.nextSonarSlotAt = slot + interval;

    if (slot > now) {
      await sleep(slot - now);
    }
  }

  // One Sonar call: live web search plus a JSON answer that follows the given
  // schema. Null on any failure or empty answer so the caller can fall back.
  async completeStructured({
    system,
    user,
    schema,
  }: {
    system: string;
    user: string;
    schema: Record<string, unknown>;
  }): Promise<PerplexityStructuredCompletion | null> {
    const key = this.apiKey;

    if (!key) {
      return null;
    }

    for (let attempt = 1; attempt <= SONAR_ATTEMPTS; attempt++) {
      await this.waitForSonarSlot();

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), SONAR_TIMEOUT_MS);

      try {
        const response = await fetch(PERPLEXITY_CHAT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model:
              process.env.ARX_WEB_SEARCH_SONAR_MODEL || DEFAULT_SONAR_MODEL,
            temperature: 0,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
            response_format: {
              type: 'json_schema',
              json_schema: { schema },
            },
            web_search_options: { search_context_size: 'low' },
          }),
          signal: controller.signal,
        });

        if (response.ok) {
          const body = (await response.json()) as PerplexityChatResponse;
          const content = body.choices?.[0]?.message?.content?.trim();

          if (!content) {
            return null;
          }

          return {
            content,
            inputTokens: body.usage?.prompt_tokens ?? 0,
            outputTokens: body.usage?.completion_tokens ?? 0,
            costUsd: body.usage?.cost?.total_cost ?? DEFAULT_SONAR_COST_USD,
          };
        }

        this.logger.warn(
          `Perplexity Sonar attempt ${attempt}/${SONAR_ATTEMPTS}: HTTP ${response.status}`,
        );

        if (response.status !== 429 && response.status < 500) {
          return null;
        }

        const retryAfterSeconds = Number(response.headers.get('retry-after'));

        if (response.status === 429 && retryAfterSeconds > 0) {
          await sleep(Math.min(retryAfterSeconds, 30) * 1_000);
        }
      } catch (error) {
        this.logger.warn(
          `Perplexity Sonar attempt ${attempt}/${SONAR_ATTEMPTS} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        clearTimeout(timeout);
      }

      if (attempt < SONAR_ATTEMPTS) {
        await sleep(SONAR_RETRY_DELAY_MS * attempt);
      }
    }

    return null;
  }
}
