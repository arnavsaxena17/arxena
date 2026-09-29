import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import { BrightDataGoogleMapsPlacesService } from 'src/engine/core-modules/bright-data/services/bright-data-google-maps-places.service';
import type {
  BrightDataGoogleMapsDiscoverByLocationInput,
  BrightDataGoogleMapsGridCell,
  BrightDataGoogleMapsPlaceRecord,
} from 'src/engine/core-modules/bright-data/types/bright-data-google-maps-place.types';
import type { CompanySearchHit } from 'src/engine/core-modules/company-api/company-api.types';
import { UpsertCompaniesService } from 'src/engine/core-modules/outreach-command/services/upsert-companies.service';

const UPSERT_BATCH_SIZE = 50;

export type FetchAndUpsertLocalBusinessesInput = {
  cells?: BrightDataGoogleMapsGridCell[];
  keywords?: unknown;
  zoom_level?: number;
  zoomLevel?: number;
  country?: string;
  maxRecords?: number;
  projectId?: string;
};

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(isNonEmptyString);
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const placeToCompanyHit = (
  place: BrightDataGoogleMapsPlaceRecord,
): CompanySearchHit | null => {
  const placeId = (place.place_id ?? '').toString().trim();
  const name = (place.name ?? '').toString().trim();

  if (!isNonEmptyString(name) && !isNonEmptyString(placeId)) {
    return null;
  }

  const website = (place.website ?? '').toString().trim();
  const mapsUrl = (place.url ?? '').toString().trim();

  return {
    id: placeId || name,
    name: name || placeId,
    website: website || mapsUrl,
    linkedinUrl: mapsUrl,
    industry: (place.category ?? '').toString().trim(),
  };
};

const dedupePlacesByPlaceId = (
  places: BrightDataGoogleMapsPlaceRecord[],
): BrightDataGoogleMapsPlaceRecord[] => {
  const byPlaceId = new Map<string, BrightDataGoogleMapsPlaceRecord>();
  const withoutId: BrightDataGoogleMapsPlaceRecord[] = [];

  for (const place of places) {
    const placeId = (place.place_id ?? '').toString().trim();

    if (!placeId) {
      withoutId.push(place);
      continue;
    }

    if (!byPlaceId.has(placeId)) {
      byPlaceId.set(placeId, place);
    }
  }

  return [...byPlaceId.values(), ...withoutId];
};

@Injectable()
export class FetchAndUpsertLocalBusinessesService {
  private readonly logger = new Logger(
    FetchAndUpsertLocalBusinessesService.name,
  );

  constructor(
    private readonly brightDataGoogleMapsPlacesService: BrightDataGoogleMapsPlacesService,
    private readonly upsertCompaniesService: UpsertCompaniesService,
  ) {}

  async execute({
    workspaceId,
    input,
  }: {
    workspaceId: string;
    input: FetchAndUpsertLocalBusinessesInput;
  }): Promise<{
    success: boolean;
    grossRecords: number;
    uniquePlaces: number;
    created: number;
    updated: number;
    skipped: number;
    companyIds: string[];
    projectId: string;
    stoppedEarly: boolean;
    error?: string;
  }> {
    const cells = Array.isArray(input.cells) ? input.cells : [];
    const keywords = toStringArray(input.keywords);
    const zoomLevel = Number(input.zoom_level ?? input.zoomLevel ?? 12);
    const country = (input.country ?? 'IN').trim() || 'IN';
    const maxRecords = Math.max(1, Number(input.maxRecords ?? 10_000));
    const projectId = (input.projectId ?? '').trim();

    if (cells.length === 0) {
      return this.failure('cells is required', projectId);
    }

    if (keywords.length === 0) {
      return this.failure('keywords is required', projectId);
    }

    if (!isNonEmptyString(projectId)) {
      return this.failure('projectId is required', '');
    }

    if (!this.brightDataGoogleMapsPlacesService.isConfigured()) {
      return this.failure('BRIGHT_DATA_API_KEY is not set', projectId);
    }

    const discoveryInputs: BrightDataGoogleMapsDiscoverByLocationInput[] = [];

    for (const cell of cells) {
      if (!Number.isFinite(cell.lat) || !Number.isFinite(cell.lng)) {
        continue;
      }

      for (const keyword of keywords) {
        discoveryInputs.push({
          country,
          lat: cell.lat,
          long: cell.lng,
          zoom_level: zoomLevel,
          keyword,
        });
      }
    }

    if (discoveryInputs.length === 0) {
      return this.failure('No valid discovery inputs', projectId);
    }

    let grossRecords = 0;
    let stoppedEarly = false;
    const collected: BrightDataGoogleMapsPlaceRecord[] = [];

    // Chunk discovery so we can stop when maxRecords of gross deliveries is hit.
    const chunkSize = 20;

    try {
      for (
        let offset = 0;
        offset < discoveryInputs.length;
        offset += chunkSize
      ) {
        if (grossRecords >= maxRecords) {
          stoppedEarly = true;
          break;
        }

        const chunk = discoveryInputs.slice(offset, offset + chunkSize);
        const records =
          await this.brightDataGoogleMapsPlacesService.discoverByLocation(
            chunk,
          );

        for (const record of records) {
          if (grossRecords >= maxRecords) {
            stoppedEarly = true;
            break;
          }

          collected.push(record);
          grossRecords += 1;
        }
      }
    } catch (error) {
      this.logger.error(
        `Bright Data Maps fetch failed: ${error instanceof Error ? error.message : error}`,
      );

      return this.failure(
        error instanceof Error ? error.message : String(error),
        projectId,
      );
    }

    const uniquePlaces = dedupePlacesByPlaceId(collected);
    const companyHits = uniquePlaces
      .map(placeToCompanyHit)
      .filter((hit): hit is CompanySearchHit => hit !== null);

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const companyIds: string[] = [];

    for (let offset = 0; offset < companyHits.length; offset += UPSERT_BATCH_SIZE) {
      const batch = companyHits.slice(offset, offset + UPSERT_BATCH_SIZE);
      const result = await this.upsertCompaniesService.execute({
        workspaceId,
        input: {
          projectId,
          companies: batch,
          limit: batch.length,
        },
      });

      if (!result.success) {
        return {
          success: false,
          grossRecords,
          uniquePlaces: uniquePlaces.length,
          created,
          updated,
          skipped,
          companyIds,
          projectId,
          stoppedEarly,
          error: result.error ?? 'upsert-companies failed',
        };
      }

      created += result.created;
      updated += result.updated;
      skipped += result.skipped;
      companyIds.push(...result.companyIds);
    }

    return {
      success: true,
      grossRecords,
      uniquePlaces: uniquePlaces.length,
      created,
      updated,
      skipped,
      companyIds,
      projectId,
      stoppedEarly,
    };
  }

  private failure(error: string, projectId: string) {
    return {
      success: false,
      grossRecords: 0,
      uniquePlaces: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      companyIds: [] as string[],
      projectId,
      stoppedEarly: false,
      error,
    };
  }
}
