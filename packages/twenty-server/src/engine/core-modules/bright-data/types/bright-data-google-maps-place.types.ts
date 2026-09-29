export type BrightDataGoogleMapsDiscoverByLocationInput = {
  country: string;
  lat: number;
  long: number;
  zoom_level: number;
  keyword: string;
};

export type BrightDataGoogleMapsPlaceRecord = {
  place_id?: string | null;
  name?: string | null;
  address?: string | null;
  category?: string | null;
  rating?: number | null;
  reviews_count?: number | null;
  phone?: string | null;
  website?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  url?: string | null;
  open_hours?: Record<string, unknown> | null;
  photos?: unknown[] | null;
  error?: string | null;
  [key: string]: unknown;
};

export type BrightDataGoogleMapsGridCell = {
  lat: number;
  lng: number;
};
