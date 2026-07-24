import { Injectable, Logger } from '@nestjs/common';

import { normalizeLinkedInUrl } from 'src/engine/core-modules/candidate-sourcing/utils/linkedin-url.utils';
import type { LinkedInPeopleSearchResult } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-response.type';

import type { BrightDataLinkedinProfileRecord } from '../types/bright-data-linkedin-profile.types';
import { mergeBrightDataIntoLinkedinPeopleSearchResult } from '../utils/map-bright-data-linkedin-profile-to-people-search';

const BRIGHT_DATA_DATASET_SCRAPE_URL =
  'https://api.brightdata.com/datasets/v3/scrape';

export type BrightDataEnrichProgressEvent =
  | { kind: 'batchStart'; totalUrls: number }
  | {
      kind: 'profileRequestDone';
      index: number;
      total: number;
      url: string;
      success: boolean;
    }
  | { kind: 'batchComplete'; recordsReturned: number };

export type EnrichLinkedinPeopleSearchResultsOptions = {
  onProgress?: (event: BrightDataEnrichProgressEvent) => void | Promise<void>;
};

@Injectable()
export class BrightDataLinkedinProfileScrapeService {
  private readonly logger = new Logger(BrightDataLinkedinProfileScrapeService.name);

  private get apiKey(): string | undefined {
    return process.env.BRIGHT_DATA_API_KEY?.trim() || undefined;
  }

  private get datasetId(): string {
    return (
      process.env.BRIGHT_DATA_LINKEDIN_PROFILE_DATASET_ID?.trim() ||
      'gd_l1viktl72bvl7bjuj0'
    );
  }

  private get requestTimeoutMs(): number {
    return Number(process.env.BRIGHT_DATA_LINKEDIN_PROFILE_SCRAPE_TIMEOUT_MS ?? 120_000);
  }

  /**
   * Concurrent Bright Data scrape requests (one HTTP request per profile URL).
   */
  private get parallelConcurrency(): number {
    const raw = Number(
      process.env.BRIGHT_DATA_LINKEDIN_PROFILE_SCRAPE_CONCURRENCY ?? 8,
    );

    return Math.max(1, Math.min(32, Number.isFinite(raw) ? raw : 8));
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Synchronous Bright Data dataset scrape for LinkedIn profile URLs (batch in one request).
   */
  async scrapeProfilesByUrl(
    urls: string[],
  ): Promise<BrightDataLinkedinProfileRecord[]> {
    const key = this.apiKey;
    if (!key) {
      throw new Error('BRIGHT_DATA_API_KEY is not set');
    }

    const uniqueUrls = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];

    if (uniqueUrls.length === 0) {
      return [];
    }

    const datasetId = this.datasetId;
    const endpoint = new URL(BRIGHT_DATA_DATASET_SCRAPE_URL);

    endpoint.searchParams.set('dataset_id', datasetId);
    endpoint.searchParams.set('notify', 'false');
    endpoint.searchParams.set('include_errors', 'true');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await fetch(endpoint.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          input: uniqueUrls.map((url) => ({ url })),
        }),
        signal: controller.signal,
      });

      const rawText = await response.text();

      if (!response.ok) {
        this.logger.warn(
          `Bright Data LinkedIn profile scrape HTTP ${response.status}: ${rawText.slice(0, 500)}`,
        );

        return [];
      }

      const parsed = this.parseScrapeResponseJson(rawText);

      return parsed;
    } catch (error) {
      this.logger.error(
        `Bright Data LinkedIn profile scrape failed: ${error instanceof Error ? error.message : error}`,
      );

      return [];
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * One Bright Data scrape request for a single profile URL.
   */
  private async scrapeSingleProfileUrl(
    url: string,
  ): Promise<BrightDataLinkedinProfileRecord | null> {
    const key = this.apiKey;
    if (!key) {
      return null;
    }

    const trimmed = url.trim();
    if (!trimmed) {
      return null;
    }

    const datasetId = this.datasetId;
    const endpoint = new URL(BRIGHT_DATA_DATASET_SCRAPE_URL);

    endpoint.searchParams.set('dataset_id', datasetId);
    endpoint.searchParams.set('notify', 'false');
    endpoint.searchParams.set('include_errors', 'true');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await fetch(endpoint.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          input: [{ url: trimmed }],
        }),
        signal: controller.signal,
      });

      const rawText = await response.text();

      if (!response.ok) {
        this.logger.warn(
          `Bright Data single profile scrape HTTP ${response.status} url=${trimmed.slice(0, 80)}: ${rawText.slice(0, 300)}`,
        );

        return null;
      }

      const parsed = this.parseScrapeResponseJson(rawText);

      console.log("Parsed : ", parsed)

      return parsed[0] ?? null;
    } catch (error) {
      this.logger.error(
        `Bright Data single profile scrape failed url=${trimmed.slice(0, 80)}: ${error instanceof Error ? error.message : error}`,
      );

      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async scrapeProfilesByUrlParallel(
    urls: string[],
    onProgress?: (
      done: {
        index: number;
        total: number;
        url: string;
        success: boolean;
      },
    ) => void | Promise<void>,
  ): Promise<BrightDataLinkedinProfileRecord[]> {
    const uniqueUrls = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];

    if (uniqueUrls.length === 0) {
      return [];
    }

    console.log("Unique URLs : ", uniqueUrls)

    const total = uniqueUrls.length;
    const concurrency = Math.min(this.parallelConcurrency, total);
    const records: BrightDataLinkedinProfileRecord[] = [];
    let nextIndex = 0;

    const runWorker = async () => {
      while (true) {
        const i = nextIndex;
        nextIndex += 1;

        if (i >= total) {
          break;
        }

        const url = uniqueUrls[i];
        const record = await this.scrapeSingleProfileUrl(url);
        const success = Boolean(record);

        if (record) {
          records.push(record);
        }

        await onProgress?.({ index: i, total, url, success });
      }
    };

    await Promise.all(
      Array.from({ length: concurrency }, () => runWorker()),
    );

    return records;
  }

  private parseScrapeResponseJson(rawText: string): BrightDataLinkedinProfileRecord[] {
    const trimmed = rawText.trim();

    if (!trimmed) {
      return [];
    }

    const tryParseObject = (chunk: string): BrightDataLinkedinProfileRecord[] => {
      try {
        const parsed: unknown = JSON.parse(chunk);

        if (Array.isArray(parsed)) {
          return parsed.filter(
            (row): row is BrightDataLinkedinProfileRecord =>
              row !== null && typeof row === 'object',
          );
        }

        if (parsed && typeof parsed === 'object') {
          return [parsed as BrightDataLinkedinProfileRecord];
        }
      } catch {
        return [];
      }

      return [];
    };

    const fromSingle = tryParseObject(trimmed);

    if (fromSingle.length > 0) {
      return fromSingle;
    }

    const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
    const fromNdjson: BrightDataLinkedinProfileRecord[] = [];

    for (const line of lines) {
      const rows = tryParseObject(line);

      fromNdjson.push(...rows);
    }

    if (fromNdjson.length > 0) {
      return fromNdjson;
    }

    this.logger.warn(
      `Bright Data LinkedIn profile scrape: could not parse JSON: ${trimmed.slice(0, 200)}`,
    );

    return [];
  }

  /**
   * Keyed by normalized profile URL for merging back onto SERP rows.
   */
  private buildProfileMap(
    records: BrightDataLinkedinProfileRecord[],
  ): Map<string, BrightDataLinkedinProfileRecord> {
    const map = new Map<string, BrightDataLinkedinProfileRecord>();

    for (const row of records) {
      const raw =
        row.input_url ||
        row.url ||
        (row as { input?: { url?: string } }).input?.url ||
        '';

      if (!raw) {
        continue;
      }

      try {
        map.set(normalizeLinkedInUrl(raw), row);
      } catch {
        map.set(raw, row);
      }
    }

    return map;
  }

  /**
   * Fetches full LinkedIn profiles for SERP candidates and merges fields into each row.
   * Uses parallel async Bright Data requests (one HTTP call per profile).
   */
  async enrichLinkedinPeopleSearchResults(
    candidates: LinkedInPeopleSearchResult[],
    options?: EnrichLinkedinPeopleSearchResultsOptions,
  ): Promise<LinkedInPeopleSearchResult[]> {
    if (!this.isConfigured() || candidates.length === 0) {
      return candidates;
    }

    const urls = candidates
      .map((c) => c.profile_url || c.public_profile_url || '')
      .filter(Boolean);

    if (urls.length === 0) {
      return candidates;
    }

    const onProgress = options?.onProgress;

    await onProgress?.({ kind: 'batchStart', totalUrls: urls.length });

    const scraped = await this.scrapeProfilesByUrlParallel(urls, async (done) => {
      await onProgress?.({
        kind: 'profileRequestDone',
        index: done.index,
        total: done.total,
        url: done.url,
        success: done.success,
      });
    });

    await onProgress?.({ kind: 'batchComplete', recordsReturned: scraped.length });

    const byUrl = this.buildProfileMap(scraped);

    return candidates.map((candidate) => {
      const rawUrl = candidate.profile_url || candidate.public_profile_url || '';
      let key: string;

      try {
        key = normalizeLinkedInUrl(rawUrl);
      } catch {
        key = rawUrl;
      }

      const bd = byUrl.get(key);

      if (!bd) {
        return candidate;
      }

      return mergeBrightDataIntoLinkedinPeopleSearchResult(candidate, bd);
    });
  }
}
