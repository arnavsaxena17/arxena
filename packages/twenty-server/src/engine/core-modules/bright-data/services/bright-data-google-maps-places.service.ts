import { Injectable, Logger } from '@nestjs/common';

import type {
  BrightDataGoogleMapsDiscoverByLocationInput,
  BrightDataGoogleMapsPlaceRecord,
} from 'src/engine/core-modules/bright-data/types/bright-data-google-maps-place.types';

const BRIGHT_DATA_DATASET_SCRAPE_URL =
  'https://api.brightdata.com/datasets/v3/scrape';
const BRIGHT_DATA_DATASET_TRIGGER_URL =
  'https://api.brightdata.com/datasets/v3/trigger';
const BRIGHT_DATA_DATASET_PROGRESS_URL =
  'https://api.brightdata.com/datasets/v3/progress';
const BRIGHT_DATA_DATASET_SNAPSHOT_URL =
  'https://api.brightdata.com/datasets/v3/snapshot';

const DEFAULT_DATASET_ID = 'gd_m8ebnr0q2qlklc02fz';
const SYNC_INPUT_LIMIT = 20;
const ASYNC_INPUT_LIMIT = 5_000;

@Injectable()
export class BrightDataGoogleMapsPlacesService {
  private readonly logger = new Logger(BrightDataGoogleMapsPlacesService.name);

  private get apiKey(): string | undefined {
    return process.env.BRIGHT_DATA_API_KEY?.trim() || undefined;
  }

  private get datasetId(): string {
    return (
      process.env.BRIGHT_DATA_GOOGLE_MAPS_DATASET_ID?.trim() ||
      DEFAULT_DATASET_ID
    );
  }

  private get requestTimeoutMs(): number {
    return Number(
      process.env.BRIGHT_DATA_GOOGLE_MAPS_SCRAPE_TIMEOUT_MS ?? 180_000,
    );
  }

  private get snapshotPollIntervalMs(): number {
    return Number(process.env.BRIGHT_DATA_SNAPSHOT_POLL_INTERVAL_MS ?? 20_000);
  }

  private get snapshotTimeoutMs(): number {
    // Full city grids often need >8m per 20-input chunk on Maps discover.
    return Number(process.env.BRIGHT_DATA_SNAPSHOT_TIMEOUT_MS ?? 1_200_000);
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  // Discover Google Maps places near lat/long points (native discover_by=location).
  async discoverByLocation(
    inputs: BrightDataGoogleMapsDiscoverByLocationInput[],
  ): Promise<BrightDataGoogleMapsPlaceRecord[]> {
    const key = this.apiKey;

    if (!key) {
      throw new Error('BRIGHT_DATA_API_KEY is not set');
    }

    const normalized = inputs.filter(
      (input) =>
        Number.isFinite(input.lat) &&
        Number.isFinite(input.long) &&
        Boolean(input.keyword?.trim()) &&
        Boolean(input.country?.trim()),
    );

    if (normalized.length === 0) {
      return [];
    }

    const records: BrightDataGoogleMapsPlaceRecord[] = [];

    for (let offset = 0; offset < normalized.length; offset += ASYNC_INPUT_LIMIT) {
      const chunk = normalized.slice(offset, offset + ASYNC_INPUT_LIMIT);

      if (chunk.length <= SYNC_INPUT_LIMIT) {
        const scraped = await this.scrapeDiscoverByLocation(chunk);

        records.push(...scraped);
        continue;
      }

      const triggered = await this.triggerDiscoverByLocation(chunk);

      records.push(...triggered);
    }

    return records;
  }

  private async scrapeDiscoverByLocation(
    inputs: BrightDataGoogleMapsDiscoverByLocationInput[],
  ): Promise<BrightDataGoogleMapsPlaceRecord[]> {
    const key = this.apiKey;

    if (!key) {
      throw new Error('BRIGHT_DATA_API_KEY is not set');
    }

    const endpoint = new URL(BRIGHT_DATA_DATASET_SCRAPE_URL);

    endpoint.searchParams.set('dataset_id', this.datasetId);
    endpoint.searchParams.set('format', 'json');
    endpoint.searchParams.set('type', 'discover_new');
    endpoint.searchParams.set('discover_by', 'location');
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
        body: JSON.stringify({ input: inputs }),
        signal: controller.signal,
      });

      const rawText = await response.text();

      if (!response.ok) {
        this.logger.warn(
          `Bright Data Maps discover scrape HTTP ${response.status}: ${rawText.slice(0, 500)}`,
        );

        throw new Error(
          `Bright Data Maps discover failed: HTTP ${response.status}`,
        );
      }

      // Sync scrape may return snapshot_id when collection exceeds the wait window.
      try {
        const maybeSnapshot = JSON.parse(rawText) as { snapshot_id?: string };

        if (
          maybeSnapshot &&
          typeof maybeSnapshot === 'object' &&
          !Array.isArray(maybeSnapshot) &&
          typeof maybeSnapshot.snapshot_id === 'string' &&
          maybeSnapshot.snapshot_id.trim()
        ) {
          return this.pollSnapshotUntilReady(maybeSnapshot.snapshot_id.trim());
        }
      } catch {
        // Fall through to NDJSON / array parse.
      }

      return this.parsePlaceRecords(rawText);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async triggerDiscoverByLocation(
    inputs: BrightDataGoogleMapsDiscoverByLocationInput[],
  ): Promise<BrightDataGoogleMapsPlaceRecord[]> {
    const key = this.apiKey;

    if (!key) {
      throw new Error('BRIGHT_DATA_API_KEY is not set');
    }

    const endpoint = new URL(BRIGHT_DATA_DATASET_TRIGGER_URL);

    endpoint.searchParams.set('dataset_id', this.datasetId);
    endpoint.searchParams.set('format', 'json');
    endpoint.searchParams.set('type', 'discover_new');
    endpoint.searchParams.set('discover_by', 'location');
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
        body: JSON.stringify({ input: inputs }),
        signal: controller.signal,
      });

      const rawText = await response.text();

      if (!response.ok) {
        this.logger.warn(
          `Bright Data Maps discover trigger HTTP ${response.status}: ${rawText.slice(0, 500)}`,
        );

        throw new Error(
          `Bright Data Maps discover trigger failed: HTTP ${response.status}`,
        );
      }

      const parsed = JSON.parse(rawText) as { snapshot_id?: string };
      const snapshotId = parsed.snapshot_id?.trim();

      if (!snapshotId) {
        throw new Error(
          'Bright Data Maps discover trigger returned no snapshot_id',
        );
      }

      return this.pollSnapshotUntilReady(snapshotId);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async pollSnapshotUntilReady(
    snapshotId: string,
  ): Promise<BrightDataGoogleMapsPlaceRecord[]> {
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
          `Bright Data Maps snapshot progress HTTP ${progressResponse.status}`,
        );
      }

      const progress = JSON.parse(progressText) as { status?: string };
      const status = (progress.status ?? 'running').toString().toLowerCase();

      this.logger.log(
        `Bright Data Maps snapshot poll snapshotId=${snapshotId} attempt=${attempt} status=${status}`,
      );

      if (status === 'failed' || status === 'canceled') {
        throw new Error(
          `Bright Data Maps snapshot ${snapshotId} ended with status=${status}`,
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
            `Bright Data Maps snapshot download HTTP ${snapshotResponse.status}`,
          );
        }

        return this.parsePlaceRecords(snapshotText);
      }

      await new Promise((resolve) =>
        setTimeout(resolve, this.snapshotPollIntervalMs),
      );
    }

    throw new Error(
      `Bright Data Maps snapshot ${snapshotId} timed out after ${this.snapshotTimeoutMs}ms`,
    );
  }

  private parsePlaceRecords(
    rawText: string,
  ): BrightDataGoogleMapsPlaceRecord[] {
    const trimmed = rawText.trim();

    if (!trimmed) {
      return [];
    }

    const tryParse = (chunk: string): BrightDataGoogleMapsPlaceRecord[] => {
      try {
        const parsed: unknown = JSON.parse(chunk);

        if (Array.isArray(parsed)) {
          return parsed.filter(
            (row): row is BrightDataGoogleMapsPlaceRecord =>
              row !== null && typeof row === 'object',
          );
        }

        if (parsed && typeof parsed === 'object') {
          return [parsed as BrightDataGoogleMapsPlaceRecord];
        }
      } catch {
        return [];
      }

      return [];
    };

    const fromSingle = tryParse(trimmed);

    if (fromSingle.length > 0) {
      return fromSingle;
    }

    const fromNdjson: BrightDataGoogleMapsPlaceRecord[] = [];

    for (const line of trimmed.split('\n').map((row) => row.trim()).filter(Boolean)) {
      fromNdjson.push(...tryParse(line));
    }

    if (fromNdjson.length === 0) {
      this.logger.warn(
        `Bright Data Maps: could not parse place JSON: ${trimmed.slice(0, 200)}`,
      );
    }

    return fromNdjson;
  }
}
