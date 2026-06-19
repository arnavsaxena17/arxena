type UnipileAccountsListResponse = {
  items?: Record<string, unknown>[];
};

type CachedUnipileAccountsList = {
  response: UnipileAccountsListResponse;
  expiresAt: number;
};

const UNIPILE_ACCOUNTS_LIST_CACHE_TTL_MS = 45_000;

let cachedList: CachedUnipileAccountsList | null = null;
let inFlightFetch: Promise<UnipileAccountsListResponse> | null = null;

export const shouldInvalidateUnipileAccountsListCache = (
  endpoint: string,
  method: string,
): boolean => {
  const normalizedMethod = method.toUpperCase();
  if (normalizedMethod !== 'POST' && normalizedMethod !== 'DELETE') {
    return false;
  }

  const path = endpoint.split('?')[0] ?? endpoint;
  return path === '/api/v1/accounts' || path.startsWith('/api/v1/accounts/');
};

export const invalidateUnipileAccountsListCache = (): void => {
  cachedList = null;
  inFlightFetch = null;
};

export const getCachedUnipileAccountsList = (): UnipileAccountsListResponse | null => {
  if (!cachedList || cachedList.expiresAt <= Date.now()) {
    return null;
  }

  return cachedList.response;
};

export const fetchUnipileAccountsListWithCache = (
  fetcher: () => Promise<UnipileAccountsListResponse>,
): Promise<UnipileAccountsListResponse> => {
  const cached = getCachedUnipileAccountsList();
  if (cached) {
    return Promise.resolve(cached);
  }

  if (!inFlightFetch) {
    inFlightFetch = fetcher()
      .then((response) => {
        cachedList = {
          response,
          expiresAt: Date.now() + UNIPILE_ACCOUNTS_LIST_CACHE_TTL_MS,
        };
        return response;
      })
      .finally(() => {
        inFlightFetch = null;
      });
  }

  return inFlightFetch;
};
