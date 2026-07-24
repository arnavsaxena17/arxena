import type { UnipileConnectionStatusResponse } from './linkedinUnipileExtensionBridge';

const CONNECTION_STATUS_TTL_MS = 60_000;

type CachedConnectionStatus = {
  status: UnipileConnectionStatusResponse;
  expiresAt: number;
};

const statusCache = new Map<string, CachedConnectionStatus>();
const inFlightByToken = new Map<
  string,
  Promise<UnipileConnectionStatusResponse | null>
>();

const cacheKeyFor = (accessToken: string, serverBaseUrl: string): string =>
  `${serverBaseUrl.replace(/\/$/, '')}:${accessToken}`;

export const getCachedUnipileConnectionStatus = (
  accessToken: string,
  serverBaseUrl: string,
): UnipileConnectionStatusResponse | null => {
  const cached = statusCache.get(cacheKeyFor(accessToken, serverBaseUrl));
  if (!cached || cached.expiresAt <= Date.now()) {
    return null;
  }
  return cached.status;
};

export const setCachedUnipileConnectionStatus = (
  accessToken: string,
  serverBaseUrl: string,
  status: UnipileConnectionStatusResponse,
): void => {
  statusCache.set(cacheKeyFor(accessToken, serverBaseUrl), {
    status,
    expiresAt: Date.now() + CONNECTION_STATUS_TTL_MS,
  });
};

export const invalidateUnipileConnectionStatusCache = (
  accessToken?: string,
  serverBaseUrl?: string,
): void => {
  if (!accessToken?.trim()) {
    statusCache.clear();
    inFlightByToken.clear();
    return;
  }
  const base = serverBaseUrl?.replace(/\/$/, '') ?? '';
  const key = cacheKeyFor(accessToken, base);
  statusCache.delete(key);
  inFlightByToken.delete(key);
};

export const coalesceUnipileConnectionStatusFetch = (
  accessToken: string,
  serverBaseUrl: string,
  fetcher: () => Promise<UnipileConnectionStatusResponse | null>,
): Promise<UnipileConnectionStatusResponse | null> => {
  const key = cacheKeyFor(accessToken, serverBaseUrl);
  const cached = getCachedUnipileConnectionStatus(accessToken, serverBaseUrl);
  if (cached) {
    return Promise.resolve(cached);
  }

  const inFlight = inFlightByToken.get(key);
  if (inFlight) {
    return inFlight;
  }

  const promise = fetcher()
    .then((status) => {
      if (status) {
        setCachedUnipileConnectionStatus(accessToken, serverBaseUrl, status);
      }
      return status;
    })
    .finally(() => {
      if (inFlightByToken.get(key) === promise) {
        inFlightByToken.delete(key);
      }
    });

  inFlightByToken.set(key, promise);
  return promise;
};
