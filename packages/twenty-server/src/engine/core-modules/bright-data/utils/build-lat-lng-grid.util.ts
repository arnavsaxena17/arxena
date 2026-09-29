import type { BrightDataGoogleMapsGridCell } from 'src/engine/core-modules/bright-data/types/bright-data-google-maps-place.types';

export type CityBoundingBox = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  country: string;
};

export const CITY_BOUNDING_BOXES: Record<string, CityBoundingBox> = {
  mumbai: {
    minLat: 18.89,
    maxLat: 19.27,
    minLng: 72.77,
    maxLng: 72.98,
    country: 'IN',
  },
};

export const DEFAULT_GRID_SPACING_DEG = 0.025;

export const buildLatLngGrid = ({
  minLat,
  maxLat,
  minLng,
  maxLng,
  spacingDeg = DEFAULT_GRID_SPACING_DEG,
}: {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  spacingDeg?: number;
}): BrightDataGoogleMapsGridCell[] => {
  const spacing = Math.max(0.005, spacingDeg);
  const cells: BrightDataGoogleMapsGridCell[] = [];

  for (let lat = minLat; lat <= maxLat + 1e-9; lat += spacing) {
    for (let lng = minLng; lng <= maxLng + 1e-9; lng += spacing) {
      cells.push({
        lat: Number(lat.toFixed(5)),
        lng: Number(lng.toFixed(5)),
      });
    }
  }

  return cells;
};

export const resolveCityBoundingBox = (
  city: string,
): CityBoundingBox | undefined => {
  const key = city.trim().toLowerCase();

  return CITY_BOUNDING_BOXES[key];
};
