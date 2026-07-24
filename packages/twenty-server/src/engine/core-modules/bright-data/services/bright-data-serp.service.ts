import { Injectable, Logger } from '@nestjs/common';

import type {
  BrightDataDatasetSnapshotItem,
  BrightDataDatasetSnapshotListEntry,
  BrightDataDatasetSnapshotProgress,
  BrightDataSerpGoogleJson,
} from 'src/engine/core-modules/bright-data/types/bright-data-serp.types';

const BRIGHT_DATA_REQUEST_URL = 'https://api.brightdata.com/request';
const BRIGHT_DATA_DATASET_TRIGGER_URL =
  'https://api.brightdata.com/datasets/v3/trigger';
const BRIGHT_DATA_DATASET_SNAPSHOT_URL =
  'https://api.brightdata.com/datasets/v3/snapshot';
const BRIGHT_DATA_DATASET_SNAPSHOTS_URL =
  'https://api.brightdata.com/datasets/v3/snapshots';
const BRIGHT_DATA_DATASET_PROGRESS_URL =
  'https://api.brightdata.com/datasets/v3/progress';

export type BrightDataDatasetScrapeInput = {
  url: string;
  keyword: string;
  language?: string;
  uule?: string;
  brd_mobile?: string;
  tbs?: string;
  nfpr?: string;
  index?: string;
  tbm?: string;
};

@Injectable()
export class BrightDataSerpService {
  private readonly logger = new Logger(BrightDataSerpService.name);

  private get apiKey(): string | undefined {
    return process.env.BRIGHT_DATA_API_KEY?.trim() || undefined;
  }

  private get zone(): string {
    return process.env.BRIGHT_DATA_SERP_ZONE?.trim() || 'serp_api';
  }

  private get requestTimeoutMs(): number {
    return Number(process.env.BRIGHT_DATA_REQUEST_TIMEOUT_MS ?? 90_000);
  }

  private get datasetScrapeTimeoutMs(): number {
    return Number(process.env.BRIGHT_DATA_DATASET_SCRAPE_TIMEOUT_MS ?? 360_000);
  }

  private get datasetId(): string {
    return (
      process.env.BRIGHT_DATA_SERP_DATASET_ID?.trim() ||
      'gd_mfz5x93lmsjjjylob'
    );
  }

  private get snapshotPollIntervalMs(): number {
    return Number(process.env.BRIGHT_DATA_SNAPSHOT_POLL_INTERVAL_MS ?? 20_000);
  }

  private get snapshotTimeoutMs(): number {
    return Number(process.env.BRIGHT_DATA_SNAPSHOT_TIMEOUT_MS ?? 480_000);
  }

  private get snapshotDiscoveryTimeoutMs(): number {
    return Number(process.env.BRIGHT_DATA_SNAPSHOT_DISCOVERY_TIMEOUT_MS ?? 360_000);
  }

  private get snapshotDownloadRetryIntervalMs(): number {
    return Number(
      process.env.BRIGHT_DATA_SNAPSHOT_DOWNLOAD_RETRY_INTERVAL_MS ?? 5_000,
    );
  }

  /** True when `BRIGHT_DATA_API_KEY` is set (SERP calls will work). */
  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Runs a Bright Data SERP zone request for a fully qualified Google search URL.
   * Uses `format: json` so the response includes a structured `organic` array when available.
   */
  async requestSerpGoogleJson(searchUrl: string): Promise<BrightDataSerpGoogleJson> {
    return this.requestSerpJson(searchUrl);
  }

  async requestSerpJson(searchUrl: string): Promise<BrightDataSerpGoogleJson> {
    const key = this.apiKey;
    if (!key) {
      throw new Error('BRIGHT_DATA_API_KEY is not set');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await fetch(BRIGHT_DATA_REQUEST_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          zone: this.zone,
          url: searchUrl,
          format: 'json',
          data_format: 'parsed',
        }),
        signal: controller.signal,
      });

      const rawText = await response.text();

      if (!response.ok) {
        this.logger.warn(
          `Bright Data SERP HTTP ${response.status}: ${rawText.slice(0, 500)}`,
        );
        throw new Error(
          `Bright Data SERP failed: HTTP ${response.status} ${response.statusText}`,
        );
      }

      return this.parseSerpJsonBody(rawText);
    } finally {
      clearTimeout(timeout);
    }
  }

  async createDatasetSnapshot(input: {
    items: BrightDataDatasetScrapeInput[];
    includePaginatedHtml: boolean;
    onStatus?: (
      update: BrightDataDatasetSnapshotProgress & {
        phase:
          | 'submitting'
          | 'submitted'
          | 'discovering_snapshot'
          | 'snapshot_discovered';
        attempt?: number;
      },
    ) => Promise<void> | void;
  }): Promise<{ snapshotId: string }> {
    const key = this.apiKey;
    if (!key) {
      throw new Error('BRIGHT_DATA_API_KEY is not set');
    }

    const createdAfterMs = Date.now() - 15_000;
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.datasetScrapeTimeoutMs,
    );
    const url = `${BRIGHT_DATA_DATASET_TRIGGER_URL}?dataset_id=${encodeURIComponent(this.datasetId)}&notify=false&include_errors=true`;

    try {
      await input.onStatus?.({
        dataset_id: this.datasetId,
        status: 'running',
        phase: 'submitting',
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          input: input.items,
          include_paginated_html: input.includePaginatedHtml,
        }),
        signal: controller.signal,
      });

      const rawText = await response.text();

      if (!response.ok) {
        this.logger.warn(
          `Bright Data dataset trigger HTTP ${response.status}: ${rawText.slice(0, 500)}`,
        );
        throw new Error(
          `Bright Data dataset trigger failed: HTTP ${response.status} ${response.statusText}`,
        );
      }

      const parsed = JSON.parse(rawText) as { snapshot_id?: string };
      const snapshotId = parsed.snapshot_id?.trim();

      if (!snapshotId) {
        await input.onStatus?.({
          dataset_id: this.datasetId,
          status: 'running',
          phase: 'discovering_snapshot',
        });

        return {
          snapshotId: await this.discoverDatasetSnapshotId({
            createdAfterMs,
            onPoll: input.onStatus,
          }),
        };
      }

      await input.onStatus?.({
        snapshot_id: snapshotId,
        dataset_id: this.datasetId,
        status: 'running',
        phase: 'submitted',
      });

      return { snapshotId };
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === 'AbortError' || /timeout|aborted/i.test(error.message))
      ) {
        this.logger.warn(
          `Bright Data dataset trigger submission exceeded ${this.datasetScrapeTimeoutMs}ms; falling back to snapshots discovery.`,
        );

        await input.onStatus?.({
          dataset_id: this.datasetId,
          status: 'running',
          phase: 'discovering_snapshot',
        });

        return {
          snapshotId: await this.discoverDatasetSnapshotId({
            createdAfterMs,
            onPoll: input.onStatus,
          }),
        };
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async pollDatasetSnapshotUntilReady(input: {
    snapshotId: string;
    onPoll?: (
      update: BrightDataDatasetSnapshotProgress & {
        attempt: number;
      },
    ) => Promise<void> | void;
  }): Promise<BrightDataDatasetSnapshotItem[]> {
    const deadline = Date.now() + this.snapshotTimeoutMs;
    let attempt = 0;

    while (Date.now() < deadline) {
      attempt += 1;

      const progress = await this.getDatasetSnapshotProgress(input.snapshotId);
      const status = progress.status?.toString().trim() || 'running';

      this.logger.log(
        `Bright Data snapshot progress poll snapshotId=${input.snapshotId} attempt=${attempt} status=${status}`,
      );

      await input.onPoll?.({
        ...progress,
        snapshot_id: progress.snapshot_id || input.snapshotId,
        status,
        attempt,
      });

      if (status.toLowerCase() === 'failed') {
        throw new Error(
          `Bright Data snapshot ${input.snapshotId} failed before completion`,
        );
      }

      if (status.toLowerCase() === 'canceled') {
        throw new Error(
          `Bright Data snapshot ${input.snapshotId} was canceled before completion`,
        );
      }

      if (status.toLowerCase() === 'ready') {
        const snapshot = await this.waitForDatasetSnapshotData({
          snapshotId: input.snapshotId,
          deadline,
          onPoll: input.onPoll,
          startAttempt: attempt,
        });

        await input.onPoll?.({
          snapshot_id: input.snapshotId,
          dataset_id: progress.dataset_id,
          status: 'ready',
          attempt,
        });

        return snapshot;
      }

      await new Promise((resolve) => setTimeout(resolve, this.snapshotPollIntervalMs));
    }

    throw new Error(
      `Bright Data snapshot ${input.snapshotId} timed out after ${this.snapshotTimeoutMs}ms`,
    );
  }

  private async waitForDatasetSnapshotData(input: {
    snapshotId: string;
    deadline: number;
    startAttempt: number;
    onPoll?: (
      update: BrightDataDatasetSnapshotProgress & {
        attempt: number;
      },
    ) => Promise<void> | void;
  }): Promise<BrightDataDatasetSnapshotItem[]> {
    let downloadAttempt = 0;

    while (Date.now() < input.deadline) {
      downloadAttempt += 1;

      const snapshot = await this.getDatasetSnapshotData(input.snapshotId);

      if (Array.isArray(snapshot)) {
        this.logger.log(
          `Bright Data snapshot download ready snapshotId=${input.snapshotId} downloadAttempt=${downloadAttempt} itemCount=${snapshot.length}`,
        );

        return snapshot;
      }

      const payloadStatus = snapshot.status?.toString().trim() || 'processing';
      const attempt = input.startAttempt + downloadAttempt;

      this.logger.warn(
        `Bright Data snapshot download not ready yet snapshotId=${input.snapshotId} downloadAttempt=${downloadAttempt} payloadStatus=${payloadStatus} message=${snapshot.message ?? ''}`.trim(),
      );

      await input.onPoll?.({
        ...snapshot,
        snapshot_id: snapshot.snapshot_id || input.snapshotId,
        status: payloadStatus,
        attempt,
      });

      await new Promise((resolve) =>
        setTimeout(resolve, this.snapshotDownloadRetryIntervalMs),
      );
    }

    throw new Error(
      `Bright Data snapshot ${input.snapshotId} became ready in progress but download payload was unavailable before timeout`,
    );
  }

  private async getDatasetSnapshotProgress(
    snapshotId: string,
  ): Promise<BrightDataDatasetSnapshotProgress> {
    const key = this.apiKey;
    if (!key) {
      throw new Error('BRIGHT_DATA_API_KEY is not set');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await fetch(
        `${BRIGHT_DATA_DATASET_PROGRESS_URL}/${encodeURIComponent(snapshotId)}`,
        {
          headers: {
            Authorization: `Bearer ${key}`,
          },
          signal: controller.signal,
        },
      );

      const rawText = await response.text();

      if (!response.ok) {
        this.logger.warn(
          `Bright Data snapshot progress HTTP ${response.status}: ${rawText.slice(0, 500)}`,
        );
        throw new Error(
          `Bright Data snapshot progress failed: HTTP ${response.status} ${response.statusText}`,
        );
      }

      return this.parseDatasetProgressBody(rawText, snapshotId);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async getDatasetSnapshotData(
    snapshotId: string,
  ): Promise<
    BrightDataDatasetSnapshotItem[] | BrightDataDatasetSnapshotProgress
  > {
    const key = this.apiKey;
    if (!key) {
      throw new Error('BRIGHT_DATA_API_KEY is not set');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await fetch(
        `${BRIGHT_DATA_DATASET_SNAPSHOT_URL}/${encodeURIComponent(snapshotId)}`,
        {
          headers: {
            Authorization: `Bearer ${key}`,
          },
          signal: controller.signal,
        },
      );

      const rawText = await response.text();

      if (!response.ok) {
        this.logger.warn(
          `Bright Data snapshot data HTTP ${response.status}: ${rawText.slice(0, 500)}`,
        );
        throw new Error(
          `Bright Data snapshot data fetch failed: HTTP ${response.status} ${response.statusText}`,
        );
      }

      const parsed = this.parseDatasetSnapshotBody(rawText);

      if (Array.isArray(parsed)) {
        return parsed;
      }

      this.logger.log(
        `Bright Data snapshot data response snapshotId=${snapshotId} returned non-array payload status=${parsed.status ?? 'unknown'} message=${parsed.message ?? ''}`.trim(),
      );

      return parsed;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async listDatasetSnapshots(): Promise<BrightDataDatasetSnapshotListEntry[]> {
    const key = this.apiKey;
    if (!key) {
      throw new Error('BRIGHT_DATA_API_KEY is not set');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await fetch(
        `${BRIGHT_DATA_DATASET_SNAPSHOTS_URL}?dataset_id=${encodeURIComponent(this.datasetId)}`,
        {
          headers: {
            Authorization: `Bearer ${key}`,
          },
          signal: controller.signal,
        },
      );

      const rawText = await response.text();

      if (!response.ok) {
        this.logger.warn(
          `Bright Data snapshots list HTTP ${response.status}: ${rawText.slice(0, 500)}`,
        );
        throw new Error(
          `Bright Data snapshots list failed: HTTP ${response.status} ${response.statusText}`,
        );
      }

      return this.parseDatasetSnapshotsListBody(rawText);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async discoverDatasetSnapshotId(input: {
    createdAfterMs: number;
    onPoll?: (
      update: BrightDataDatasetSnapshotProgress & {
        phase:
          | 'discovering_snapshot'
          | 'snapshot_discovered';
        attempt?: number;
      },
    ) => Promise<void> | void;
  }): Promise<string> {
    const deadline = Date.now() + this.snapshotDiscoveryTimeoutMs;
    let attempt = 0;

    while (Date.now() < deadline) {
      attempt += 1;
      const snapshots = await this.listDatasetSnapshots();
      const candidate = snapshots
        .map((entry) => ({
          id: entry.snapshot_id?.trim() || entry.id?.trim(),
          status: entry.status?.toString().trim() || 'running',
          timestamp:
            Date.parse(entry.timestamp ?? '') ||
            Date.parse(entry.created_at ?? '') ||
            Date.parse(entry.updated_at ?? '') ||
            0,
        }))
        .filter(
          (entry): entry is { id: string; status: string; timestamp: number } =>
            Boolean(entry.id) && entry.timestamp >= input.createdAfterMs,
        )
        .sort((a, b) => b.timestamp - a.timestamp)[0];

      if (candidate?.id) {
        await input.onPoll?.({
          snapshot_id: candidate.id,
          dataset_id: this.datasetId,
          status: candidate.status,
          phase: 'snapshot_discovered',
          attempt,
        });

        return candidate.id;
      }

      await input.onPoll?.({
        dataset_id: this.datasetId,
        status: 'running',
        phase: 'discovering_snapshot',
        attempt,
      });

      await new Promise((resolve) => setTimeout(resolve, this.snapshotPollIntervalMs));
    }

    throw new Error(
      `Bright Data snapshot id discovery timed out after ${this.snapshotDiscoveryTimeoutMs}ms`,
    );
  }

  private parseSerpJsonBody(rawText: string): BrightDataSerpGoogleJson {
    const trimmed = rawText.trim();
    if (!trimmed) {
      return {};
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;

      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>;
        const organic = obj.organic;
        if (Array.isArray(organic)) {
          return obj as BrightDataSerpGoogleJson;
        }

        const nestedBody = obj.body;
        if (typeof nestedBody === 'string' && nestedBody.trim()) {
          const inner = JSON.parse(nestedBody) as unknown;
          if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
            return inner as BrightDataSerpGoogleJson;
          }
        }

        const data = obj.data;
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          return data as BrightDataSerpGoogleJson;
        }

        return obj as BrightDataSerpGoogleJson;
      }
    } catch (error) {
      this.logger.warn(
        `Bright Data SERP JSON parse failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return {};
  }

  private parseDatasetSnapshotBody(
    rawText: string,
  ): BrightDataDatasetSnapshotProgress | BrightDataDatasetSnapshotItem[] {
    const trimmed = rawText.trim();

    if (!trimmed) {
      return [];
    }

    const parsed = JSON.parse(trimmed) as unknown;

    if (Array.isArray(parsed)) {
      return parsed as BrightDataDatasetSnapshotItem[];
    }

    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>;
      const data = record.data;

      if (Array.isArray(data)) {
        return data as BrightDataDatasetSnapshotItem[];
      }

      // Bright Data may return a single dataset item object instead of an array
      // when the trigger/snapshot was created with one input row.
      const looksLikeDatasetItem =
        'organic' in record ||
        'general' in record ||
        'pagination' in record ||
        ('url' in record && 'keyword' in record);

      if (looksLikeDatasetItem) {
        return [record as BrightDataDatasetSnapshotItem];
      }

      const message = record.message;

      if (typeof message === 'string') {
        const normalizedMessage = message.toLowerCase();

        return {
          snapshot_id:
            typeof record.snapshot_id === 'string' ? record.snapshot_id : undefined,
          dataset_id:
            typeof record.dataset_id === 'string' ? record.dataset_id : undefined,
          status: normalizedMessage.includes('still in progress')
            ? 'running'
            : normalizedMessage.includes('cannot be retrieved')
              ? 'running'
              : normalizedMessage.includes('failed')
                ? 'failed'
                : 'processing',
        };
      }

      return record as BrightDataDatasetSnapshotProgress;
    }

    return [];
  }

  private parseDatasetProgressBody(
    rawText: string,
    snapshotId: string,
  ): BrightDataDatasetSnapshotProgress {
    const trimmed = rawText.trim();

    if (!trimmed) {
      return {
        snapshot_id: snapshotId,
        status: 'running',
      };
    }

    try {
      const parsed = JSON.parse(trimmed) as BrightDataDatasetSnapshotProgress;

      return {
        snapshot_id: parsed.snapshot_id || snapshotId,
        dataset_id: parsed.dataset_id,
        status: parsed.status || 'running',
        message: parsed.message,
        created_at: parsed.created_at,
        updated_at: parsed.updated_at,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to parse Bright Data progress payload for snapshot ${snapshotId}: ${error instanceof Error ? error.message : String(error)}`,
      );

      return {
        snapshot_id: snapshotId,
        status: 'running',
      };
    }
  }

  private parseDatasetSnapshotsListBody(
    rawText: string,
  ): BrightDataDatasetSnapshotListEntry[] {
    const trimmed = rawText.trim();

    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed) as
        | BrightDataDatasetSnapshotListEntry[]
        | {
            snapshots?: BrightDataDatasetSnapshotListEntry[];
            items?: BrightDataDatasetSnapshotListEntry[];
          };

      if (Array.isArray(parsed)) {
        return parsed;
      }

      if (Array.isArray(parsed.snapshots)) {
        return parsed.snapshots;
      }

      if (Array.isArray(parsed.items)) {
        return parsed.items;
      }

      return [];
    } catch (error) {
      this.logger.warn(
        `Failed to parse Bright Data snapshots list payload: ${error instanceof Error ? error.message : String(error)}`,
      );

      return [];
    }
  }
}
