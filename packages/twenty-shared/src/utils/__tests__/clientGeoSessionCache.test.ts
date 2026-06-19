import { fetchClientGeoFromIpinfo } from '../clientGeo/fetchClientGeoFromIpinfo';
import {
  clearClientGeoSessionCache,
  getOrFetchClientGeoSession,
} from '../clientGeo/clientGeoSessionCache';
import {
  CLIENT_GEO_SESSION_STORAGE_KEY,
  CLIENT_GEO_SESSION_TTL_MS,
} from '../clientGeo/clientGeoSession.types';

jest.mock('../clientGeo/fetchClientGeoFromIpinfo', () => ({
  fetchClientGeoFromIpinfo: jest.fn(),
}));

const mockedFetch = fetchClientGeoFromIpinfo as jest.MockedFunction<
  typeof fetchClientGeoFromIpinfo
>;

describe('clientGeoSessionCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    clearClientGeoSessionCache();
  });

  it('returns cached session without refetching within TTL', async () => {
    const session = { ip: '203.0.113.10', country: 'US' };
    sessionStorage.setItem(
      CLIENT_GEO_SESSION_STORAGE_KEY,
      JSON.stringify({ session, cachedAt: Date.now() }),
    );

    const result = await getOrFetchClientGeoSession();

    expect(result).toEqual(session);
    expect(mockedFetch).not.toHaveBeenCalled();
    console.log('[clientGeoSessionCache.test] cache hit ok');
  });

  it('refetches when cache is expired', async () => {
    const staleSession = { ip: '1.2.3.4', country: 'IN' };
    sessionStorage.setItem(
      CLIENT_GEO_SESSION_STORAGE_KEY,
      JSON.stringify({
        session: staleSession,
        cachedAt: Date.now() - CLIENT_GEO_SESSION_TTL_MS - 1,
      }),
    );

    mockedFetch.mockResolvedValue({
      ip: '203.0.113.10',
      country: 'US',
      city: null,
      region: null,
      timezone: null,
    });

    const result = await getOrFetchClientGeoSession();

    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(result.ip).toBe('203.0.113.10');
    console.log('[clientGeoSessionCache.test] expired cache refetch ok');
  });

  it('deduplicates concurrent fetches', async () => {
    let resolveFetch: (value: {
      ip: string | null;
      country: string | null;
    }) => void = () => undefined;
    mockedFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const first = getOrFetchClientGeoSession();
    const second = getOrFetchClientGeoSession();

    resolveFetch({ ip: '203.0.113.10', country: 'US' });

    const [a, b] = await Promise.all([first, second]);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    console.log('[clientGeoSessionCache.test] in-flight dedup ok');
  });
});
