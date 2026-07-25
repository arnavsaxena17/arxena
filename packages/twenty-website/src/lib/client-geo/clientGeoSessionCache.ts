import { fetchClientGeoFromIpinfo } from './fetchClientGeoFromIpinfo';
import {
  CLIENT_GEO_SESSION_STORAGE_KEY,
  CLIENT_GEO_SESSION_TTL_MS,
  type ClientGeoSession,
} from './clientGeoSession.types';

type CachedClientGeoSession = {
  session: ClientGeoSession;
  cachedAt: number;
};

let inFlightLookup: Promise<ClientGeoSession> | null = null;

const isBrowserSessionStorageAvailable = (): boolean => {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
};

const readCachedSession = (): ClientGeoSession | null => {
  if (!isBrowserSessionStorageAvailable()) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(CLIENT_GEO_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CachedClientGeoSession;
    if (!parsed?.session || typeof parsed.cachedAt !== 'number') {
      return null;
    }

    if (Date.now() - parsed.cachedAt > CLIENT_GEO_SESSION_TTL_MS) {
      window.sessionStorage.removeItem(CLIENT_GEO_SESSION_STORAGE_KEY);
      return null;
    }

    return parsed.session;
  } catch {
    return null;
  }
};

const writeCachedSession = (session: ClientGeoSession): void => {
  if (!isBrowserSessionStorageAvailable()) {
    return;
  }

  try {
    const payload: CachedClientGeoSession = {
      session,
      cachedAt: Date.now(),
    };
    window.sessionStorage.setItem(
      CLIENT_GEO_SESSION_STORAGE_KEY,
      JSON.stringify(payload),
    );
  } catch {
    // Ignore quota / privacy mode errors.
  }
};

export const getOrFetchClientGeoSession = async (): Promise<ClientGeoSession> => {
  const cached = readCachedSession();
  if (cached) {
    return cached;
  }

  if (inFlightLookup) {
    return inFlightLookup;
  }

  inFlightLookup = fetchClientGeoFromIpinfo()
    .then((session) => {
      if (session.ip || session.country) {
        writeCachedSession(session);
      }
      return session;
    })
    .finally(() => {
      inFlightLookup = null;
    });

  return inFlightLookup;
};

export const clearClientGeoSessionCache = (): void => {
  if (!isBrowserSessionStorageAvailable()) {
    return;
  }
  window.sessionStorage.removeItem(CLIENT_GEO_SESSION_STORAGE_KEY);
};
