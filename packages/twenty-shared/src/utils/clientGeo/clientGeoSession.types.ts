export type ClientGeoSession = {
  ip: string | null;
  country: string | null;
  city?: string | null;
  region?: string | null;
  timezone?: string | null;
};

export const CLIENT_GEO_IP_HEADER = 'x-client-geo-ip';
export const CLIENT_GEO_COUNTRY_HEADER = 'x-client-geo-country';

export const CLIENT_GEO_SESSION_STORAGE_KEY = 'arx_client_geo_session';
export const CLIENT_GEO_SESSION_TTL_MS = 60 * 60 * 1000;

export type ClientGeoLinkedinBodyFields = {
  client_ip?: string;
  client_country?: string;
};
