import { Injectable, Logger } from '@nestjs/common';

import { normalizeLinkedInUrl } from 'src/engine/core-modules/candidate-sourcing/utils/linkedin-url.utils';
import type { LinkedInPeopleSearchResult } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-response.type';

import type { BrightDataLinkedinProfileRecord } from '../types/bright-data-linkedin-profile.types';
import { mergeBrightDataIntoLinkedinPeopleSearchResult } from '../utils/map-bright-data-linkedin-profile-to-people-search';

const BRIGHT_DATA_DATASET_SCRAPE_URL =
  'https://api.brightdata.com/datasets/v3/scrape';
const BRIGHT_DATA_DATASET_PROGRESS_URL =
  'https://api.brightdata.com/datasets/v3/progress';
const BRIGHT_DATA_DATASET_SNAPSHOT_URL =
  'https://api.brightdata.com/datasets/v3/snapshot';

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
  private readonly logger = new Logger(
    BrightDataLinkedinProfileScrapeService.name,
  );

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
    return Number(
      process.env.BRIGHT_DATA_LINKEDIN_PROFILE_SCRAPE_TIMEOUT_MS ?? 120_000,
    );
  }

  // Bright Data sync /scrape times out at 1m and returns snapshot_id; poll from there
  private get snapshotPollIntervalMs(): number {
    return Number(process.env.BRIGHT_DATA_SNAPSHOT_POLL_INTERVAL_MS ?? 10_000);
  }

  private get snapshotTimeoutMs(): number {
    return Number(
      process.env.BRIGHT_DATA_LINKEDIN_PROFILE_SNAPSHOT_TIMEOUT_MS ?? 300_000,
    );
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
   * On HTTP 202 / snapshot_id (sync window exceeded), polls progress and downloads.
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

      return await this.resolveScrapeResponse({
        status: response.status,
        ok: response.ok,
        rawText,
        context: `batch=${uniqueUrls.length}`,
      });
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
      const parsed = await this.resolveScrapeResponse({
        status: response.status,
        ok: response.ok,
        rawText,
        context: `url=${trimmed.slice(0, 80)}`,
      });

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
    onProgress?: (done: {
      index: number;
      total: number;
      url: string;
      success: boolean;
    }) => void | Promise<void>,
  ): Promise<BrightDataLinkedinProfileRecord[]> {
    const uniqueUrls = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];

    if (uniqueUrls.length === 0) {
      return [];
    }

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

        const profileUrl = uniqueUrls[i];
        const record = await this.scrapeSingleProfileUrl(profileUrl);
        const success = Boolean(record);

        if (record) {
          records.push(record);
        }

        await onProgress?.({ index: i, total, url: profileUrl, success });
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => runWorker()));

    return records;
  }

  // Sync /scrape past 1m → HTTP 202 + snapshot_id; poll then download
  private async resolveScrapeResponse(input: {
    status: number;
    ok: boolean;
    rawText: string;
    context: string;
  }): Promise<BrightDataLinkedinProfileRecord[]> {
    const snapshotId = this.extractSnapshotId(input.rawText);

    if (snapshotId && (input.status === 202 || input.ok)) {
      this.logger.log(
        `Bright Data LinkedIn profile scrape deferred to snapshot ${snapshotId} (${input.context})`,
      );

      try {
        return await this.pollSnapshotUntilReady(snapshotId);
      } catch (error) {
        this.logger.warn(
          `Bright Data LinkedIn profile snapshot ${snapshotId} failed: ${error instanceof Error ? error.message : error}`,
        );

        return [];
      }
    }

    if (!input.ok) {
      this.logger.warn(
        `Bright Data LinkedIn profile scrape HTTP ${input.status} (${input.context}): ${input.rawText.slice(0, 500)}`,
      );

      return [];
    }

    return this.parseScrapeResponseJson(input.rawText);
  }

  private extractSnapshotId(rawText: string): string | undefined {
    try {
      const parsed: unknown = JSON.parse(rawText.trim());

      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return undefined;
      }

      const record = parsed as Record<string, unknown>;
      const snapshotId =
        typeof record.snapshot_id === 'string' ? record.snapshot_id.trim() : '';

      if (!snapshotId) {
        return undefined;
      }

      // Deferred job body is snapshot_id (+ message); profile rows carry url/name
      if (
        typeof record.url === 'string' ||
        typeof record.input_url === 'string' ||
        typeof record.name === 'string'
      ) {
        return undefined;
      }

      return snapshotId;
    } catch {
      return undefined;
    }
  }

  private async pollSnapshotUntilReady(
    snapshotId: string,
  ): Promise<BrightDataLinkedinProfileRecord[]> {
    const key = this.apiKey;

    if (!key) {
      throw new Error('BRIGHT_DATA_API_KEY is not set');
    }

    const deadline = Date.now() + this.snapshotTimeoutMs;
    let attempt = 0;

    while (Date.now() < deadline) {
      attempt += 1;

      const progressResponse = await fetch(
        `${BRIGHT_DATA_DATASET_PROGRESS_URL}/${encodeURIComponent(snapshotId)}`,
        {
          headers: { Authorization: `Bearer ${key}` },
        },
      );
      const progressText = await progressResponse.text();

      if (!progressResponse.ok) {
        throw new Error(
          `Bright Data LinkedIn profile snapshot progress HTTP ${progressResponse.status}`,
        );
      }

      const progress = JSON.parse(progressText) as { status?: string };
      const status = (progress.status ?? 'running').toString().toLowerCase();

      this.logger.log(
        `Bright Data LinkedIn profile snapshot poll snapshotId=${snapshotId} attempt=${attempt} status=${status}`,
      );

      if (status === 'failed' || status === 'canceled') {
        throw new Error(
          `Bright Data LinkedIn profile snapshot ${snapshotId} ended with status=${status}`,
        );
      }

      if (status === 'ready') {
        const snapshotResponse = await fetch(
          `${BRIGHT_DATA_DATASET_SNAPSHOT_URL}/${encodeURIComponent(snapshotId)}?format=json`,
          {
            headers: { Authorization: `Bearer ${key}` },
          },
        );
        const snapshotText = await snapshotResponse.text();

        if (!snapshotResponse.ok) {
          throw new Error(
            `Bright Data LinkedIn profile snapshot download HTTP ${snapshotResponse.status}`,
          );
        }

        return this.parseScrapeResponseJson(snapshotText);
      }

      await new Promise((resolve) =>
        setTimeout(resolve, this.snapshotPollIntervalMs),
      );
    }

    throw new Error(
      `Bright Data LinkedIn profile snapshot ${snapshotId} timed out after ${this.snapshotTimeoutMs}ms`,
    );
  }

  private parseScrapeResponseJson(
    rawText: string,
  ): BrightDataLinkedinProfileRecord[] {
    const trimmed = rawText.trim();

    if (!trimmed) {
      return [];
    }

    const tryParseObject = (
      chunk: string,
    ): BrightDataLinkedinProfileRecord[] => {
      try {
        const parsed: unknown = JSON.parse(chunk);

        if (Array.isArray(parsed)) {
          return parsed.filter(
            (row): row is BrightDataLinkedinProfileRecord =>
              row !== null &&
              typeof row === 'object' &&
              !this.isSnapshotOnlyRecord(row as Record<string, unknown>),
          );
        }

        if (parsed && typeof parsed === 'object') {
          if (this.isSnapshotOnlyRecord(parsed as Record<string, unknown>)) {
            return [];
          }

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

    const lines = trimmed
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
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

  private isSnapshotOnlyRecord(record: Record<string, unknown>): boolean {
    return (
      typeof record.snapshot_id === 'string' &&
      record.snapshot_id.trim() !== '' &&
      typeof record.url !== 'string' &&
      typeof record.input_url !== 'string' &&
      typeof record.name !== 'string'
    );
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
      .map(
        (candidate) =>
          candidate.profile_url || candidate.public_profile_url || '',
      )
      .filter(Boolean);

    if (urls.length === 0) {
      return candidates;
    }

    const onProgress = options?.onProgress;

    await onProgress?.({ kind: 'batchStart', totalUrls: urls.length });

    const scraped = await this.scrapeProfilesByUrlParallel(
      urls,
      async (done) => {
        await onProgress?.({
          kind: 'profileRequestDone',
          index: done.index,
          total: done.total,
          url: done.url,
          success: done.success,
        });
      },
    );

    await onProgress?.({
      kind: 'batchComplete',
      recordsReturned: scraped.length,
    });

    const byUrl = this.buildProfileMap(scraped);

    return candidates.map((candidate) => {
      const rawUrl =
        candidate.profile_url || candidate.public_profile_url || '';
      let key: string;

      try {
        key = normalizeLinkedInUrl(rawUrl);
      } catch {
        key = rawUrl;
      }

      const brightDataRecord = byUrl.get(key);

      if (!brightDataRecord) {
        return candidate;
      }

      return mergeBrightDataIntoLinkedinPeopleSearchResult(
        candidate,
        brightDataRecord,
      );
    });
  }
}
