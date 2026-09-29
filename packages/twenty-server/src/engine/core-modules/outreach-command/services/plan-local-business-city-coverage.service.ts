import { Injectable, Logger } from '@nestjs/common';

import { isNonEmptyString } from '@sniptt/guards';

import { BrightDataGoogleMapsPlacesService } from 'src/engine/core-modules/bright-data/services/bright-data-google-maps-places.service';
import type {
  BrightDataGoogleMapsDiscoverByLocationInput,
  BrightDataGoogleMapsGridCell,
} from 'src/engine/core-modules/bright-data/types/bright-data-google-maps-place.types';
import {
  DEFAULT_GRID_SPACING_DEG,
  buildLatLngGrid,
  resolveCityBoundingBox,
} from 'src/engine/core-modules/bright-data/utils/build-lat-lng-grid.util';

export const BRIGHT_DATA_MAPS_PAYG_USD_PER_RECORD = 0.0015;
export const DEFAULT_EXPECTED_HITS_PER_CELL = 20;
export const DEFAULT_SAMPLE_CELL_COUNT = 5;

export type PlanLocalBusinessCityCoverageInput = {
  city?: string;
  keywords?: unknown;
  gridSpacingDeg?: number;
  zoom_level?: number;
  zoomLevel?: number;
  country?: string;
  minLat?: number;
  maxLat?: number;
  minLng?: number;
  maxLng?: number;
  sample?: boolean | string;
  expectedHitsPerCell?: number;
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

const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'true';
  }

  return false;
};

@Injectable()
export class PlanLocalBusinessCityCoverageService {
  private readonly logger = new Logger(
    PlanLocalBusinessCityCoverageService.name,
  );

  constructor(
    private readonly brightDataGoogleMapsPlacesService: BrightDataGoogleMapsPlacesService,
  ) {}

  async execute({
    input,
  }: {
    workspaceId: string;
    input: PlanLocalBusinessCityCoverageInput;
  }): Promise<{
    success: boolean;
    city: string;
    country: string;
    keywords: string[];
    zoom_level: number;
    gridSpacingDeg: number;
    cells: BrightDataGoogleMapsGridCell[];
    cellCount: number;
    discoveryInputCount: number;
    estimatedMaxRecords: number;
    estimatedUsdPayg: number;
    pricingNote: string;
    sampleHitRate: number | null;
    sampleRecordsReturned: number;
    sampleCreditsUsed: number;
    error?: string;
  }> {
    const city = (input.city ?? '').trim().toLowerCase();
    const keywords = toStringArray(input.keywords);
    const zoomLevel = Number(input.zoom_level ?? input.zoomLevel ?? 12);
    const gridSpacingDeg = Number(
      input.gridSpacingDeg ?? DEFAULT_GRID_SPACING_DEG,
    );
    const expectedHitsPerCell = Number(
      input.expectedHitsPerCell ?? DEFAULT_EXPECTED_HITS_PER_CELL,
    );
    const runSample = toBoolean(input.sample);

    if (keywords.length === 0) {
      return this.failure('keywords is required');
    }

    const preset = city ? resolveCityBoundingBox(city) : undefined;
    const minLat = Number(input.minLat ?? preset?.minLat);
    const maxLat = Number(input.maxLat ?? preset?.maxLat);
    const minLng = Number(input.minLng ?? preset?.minLng);
    const maxLng = Number(input.maxLng ?? preset?.maxLng);
    const country = (input.country ?? preset?.country ?? 'IN').trim();

    if (
      !Number.isFinite(minLat) ||
      !Number.isFinite(maxLat) ||
      !Number.isFinite(minLng) ||
      !Number.isFinite(maxLng)
    ) {
      return this.failure(
        'Provide city (e.g. mumbai) or minLat/maxLat/minLng/maxLng',
      );
    }

    const cells = buildLatLngGrid({
      minLat,
      maxLat,
      minLng,
      maxLng,
      spacingDeg: gridSpacingDeg,
    });
    const discoveryInputCount = cells.length * keywords.length;
    let sampleHitRate: number | null = null;
    let sampleRecordsReturned = 0;
    let sampleCreditsUsed = 0;

    if (runSample) {
      if (!this.brightDataGoogleMapsPlacesService.isConfigured()) {
        return this.failure('BRIGHT_DATA_API_KEY is not set');
      }

      const sampleCells = cells.slice(0, DEFAULT_SAMPLE_CELL_COUNT);
      const sampleKeyword = keywords[0];
      const sampleInputs: BrightDataGoogleMapsDiscoverByLocationInput[] =
        sampleCells.map((cell) => ({
          country,
          lat: cell.lat,
          long: cell.lng,
          zoom_level: zoomLevel,
          keyword: sampleKeyword,
        }));

      try {
        const sampleRecords =
          await this.brightDataGoogleMapsPlacesService.discoverByLocation(
            sampleInputs,
          );

        sampleRecordsReturned = sampleRecords.length;
        sampleCreditsUsed = sampleRecords.length;
        sampleHitRate =
          sampleInputs.length > 0
            ? sampleRecords.length / sampleInputs.length
            : 0;
      } catch (error) {
        this.logger.warn(
          `Bright Data Maps sample discover failed: ${error instanceof Error ? error.message : error}`,
        );

        return this.failure(
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    const hitsPerCell =
      sampleHitRate !== null && Number.isFinite(sampleHitRate)
        ? Math.max(1, Math.round(sampleHitRate))
        : expectedHitsPerCell;
    const estimatedMaxRecords = discoveryInputCount * hitsPerCell;
    const estimatedUsdPayg = Number(
      (estimatedMaxRecords * BRIGHT_DATA_MAPS_PAYG_USD_PER_RECORD).toFixed(4),
    );

    return {
      success: true,
      city: city || 'custom',
      country,
      keywords,
      zoom_level: zoomLevel,
      gridSpacingDeg,
      cells,
      cellCount: cells.length,
      discoveryInputCount,
      estimatedMaxRecords,
      estimatedUsdPayg,
      pricingNote: `Bright Data Maps PAYG ~$${BRIGHT_DATA_MAPS_PAYG_USD_PER_RECORD}/record ($${(
        BRIGHT_DATA_MAPS_PAYG_USD_PER_RECORD * 1000
      ).toFixed(2)}/1K). Budget uses gross delivered records before place_id dedupe.`,
      sampleHitRate,
      sampleRecordsReturned,
      sampleCreditsUsed,
    };
  }

  private failure(error: string) {
    return {
      success: false,
      city: '',
      country: '',
      keywords: [] as string[],
      zoom_level: 12,
      gridSpacingDeg: DEFAULT_GRID_SPACING_DEG,
      cells: [] as BrightDataGoogleMapsGridCell[],
      cellCount: 0,
      discoveryInputCount: 0,
      estimatedMaxRecords: 0,
      estimatedUsdPayg: 0,
      pricingNote: '',
      sampleHitRate: null,
      sampleRecordsReturned: 0,
      sampleCreditsUsed: 0,
      error,
    };
  }
}
