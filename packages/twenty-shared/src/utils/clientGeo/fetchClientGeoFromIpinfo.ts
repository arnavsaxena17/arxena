import { type ClientGeoSession } from './clientGeoSession.types';
import { resolveIpinfoToken } from './resolveIpinfoToken';

const IPINFO_JSON_URL = 'https://ipinfo.io/json';
const FETCH_TIMEOUT_MS = 5_000;

type IpInfoJsonResponse = {
  ip?: string;
  country?: string;
  city?: string;
  region?: string;
  timezone?: string;
};

const emptySession = (): ClientGeoSession => ({
  ip: null,
  country: null,
  city: null,
  region: null,
  timezone: null,
});

const normalizeCountry = (value?: string): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeOptionalString = (value?: string): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const fetchClientGeoFromIpinfo = async (): Promise<ClientGeoSession> => {
  try {
    const token = resolveIpinfoToken();
    const url = token
      ? `${IPINFO_JSON_URL}?token=${encodeURIComponent(token)}`
      : IPINFO_JSON_URL;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('[fetchClientGeoFromIpinfo] ipinfo lookup failed:', response.status);
      return emptySession();
    }

    const data = (await response.json()) as IpInfoJsonResponse;

    const session: ClientGeoSession = {
      ip: normalizeOptionalString(data.ip),
      country: normalizeCountry(data.country),
      city: normalizeOptionalString(data.city),
      region: normalizeOptionalString(data.region),
      timezone: normalizeOptionalString(data.timezone),
    };

    console.log(
      '[fetchClientGeoFromIpinfo] resolved ip=',
      session.ip,
      'country=',
      session.country,
    );

    return session;
  } catch (error) {
    console.warn('[fetchClientGeoFromIpinfo] lookup error:', error);
    return emptySession();
  }
};
