import { isPrivateOrLocalClientIp } from './isPrivateOrLocalClientIp';
import { resolveIpinfoToken } from './resolveIpinfoToken';

const IPINFO_API_BASE = 'https://ipinfo.io';
const LOOKUP_TIMEOUT_MS = 3_000;
const IPINFO_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const IPINFO_CACHE_MAX_ENTRIES = 5_000;

export type IpInfoLookupPayload = {
  country: string | null;
  org: string | null;
  hostname: string | null;
};

type CachedIpInfoLookup = {
  payload: IpInfoLookupPayload;
  cachedAt: number;
};

const ipInfoLookupCache = new Map<string, CachedIpInfoLookup>();
const inFlightIpInfoLookups = new Map<string, Promise<IpInfoLookupPayload>>();

const EMPTY_PAYLOAD: IpInfoLookupPayload = {
  country: null,
  org: null,
  hostname: null,
};

const readCachedPayload = (ip: string): IpInfoLookupPayload | null => {
  const cached = ipInfoLookupCache.get(ip);
  if (!cached) {
    return null;
  }
  if (Date.now() - cached.cachedAt > IPINFO_CACHE_TTL_MS) {
    ipInfoLookupCache.delete(ip);
    return null;
  }
  // Refresh LRU order
  ipInfoLookupCache.delete(ip);
  ipInfoLookupCache.set(ip, cached);
  return cached.payload;
};

const writeCachedPayload = (ip: string, payload: IpInfoLookupPayload): void => {
  ipInfoLookupCache.set(ip, { payload, cachedAt: Date.now() });
  while (ipInfoLookupCache.size > IPINFO_CACHE_MAX_ENTRIES) {
    const oldestKey = ipInfoLookupCache.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    ipInfoLookupCache.delete(oldestKey);
  }
};

const fetchIpInfoLookupUncached = async (
  normalizedIp: string,
): Promise<{ payload: IpInfoLookupPayload; cacheable: boolean }> => {
  const token = resolveIpinfoToken();
  const url = token
    ? `${IPINFO_API_BASE}/${encodeURIComponent(normalizedIp)}?token=${encodeURIComponent(token)}`
    : `${IPINFO_API_BASE}/${encodeURIComponent(normalizedIp)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('[fetchIpInfoLookup] ipinfo lookup failed', {
        clientIp: normalizedIp,
        status: response.status,
      });
      return { payload: EMPTY_PAYLOAD, cacheable: false };
    }

    const data = (await response.json()) as {
      country?: string;
      org?: string;
      hostname?: string;
    };

    return {
      payload: {
        country: data.country?.trim().toUpperCase() || null,
        org: data.org?.trim() || null,
        hostname: data.hostname?.trim() || null,
      },
      cacheable: true,
    };
  } catch (error) {
    console.warn('[fetchIpInfoLookup] ipinfo lookup error', {
      clientIp: normalizedIp,
      error: error instanceof Error ? error.message : String(error),
    });
    return { payload: EMPTY_PAYLOAD, cacheable: false };
  }
};

export const fetchIpInfoLookup = async (
  clientIp: string,
): Promise<IpInfoLookupPayload> => {
  const normalizedIp = clientIp.trim();
  if (!normalizedIp || isPrivateOrLocalClientIp(normalizedIp)) {
    return EMPTY_PAYLOAD;
  }

  const cached = readCachedPayload(normalizedIp);
  if (cached) {
    return cached;
  }

  const inFlight = inFlightIpInfoLookups.get(normalizedIp);
  if (inFlight) {
    return inFlight;
  }

  const lookupPromise = fetchIpInfoLookupUncached(normalizedIp)
    .then(({ payload, cacheable }) => {
      if (cacheable) {
        writeCachedPayload(normalizedIp, payload);
      }
      return payload;
    })
    .finally(() => {
      inFlightIpInfoLookups.delete(normalizedIp);
    });

  inFlightIpInfoLookups.set(normalizedIp, lookupPromise);
  return lookupPromise;
};

export const clearIpInfoLookupCache = (): void => {
  ipInfoLookupCache.clear();
  inFlightIpInfoLookups.clear();
};
