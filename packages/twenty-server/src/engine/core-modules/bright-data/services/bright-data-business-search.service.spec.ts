import { BrightDataBusinessSearchService } from 'src/engine/core-modules/bright-data/services/bright-data-business-search.service';
import { ProviderQueryCacheService } from 'src/engine/core-modules/cache-storage/services/provider-query-cache.service';
import { ProviderCallLogService } from 'src/engine/core-modules/provider-call-log/services/provider-call-log.service';

describe('BrightDataBusinessSearchService', () => {
  const service = new BrightDataBusinessSearchService();

  beforeEach(() => {
    process.env.BRIGHT_DATA_API_KEY = 'test-key';
    // The service paces requests to Bright Data's limit; tests must not wait
    process.env.BRIGHT_DATA_BUSINESS_SEARCH_REQUESTS_PER_MINUTE = '1000000000';
  });

  afterEach(() => {
    delete process.env.BRIGHT_DATA_API_KEY;
    delete process.env.BRIGHT_DATA_BUSINESS_SEARCH_REQUESTS_PER_MINUTE;
    jest.restoreAllMocks();
  });

  it('stops paging when a page is short of the page size', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            req_id: 'r1',
            meta: { matched: 12 },
            documents: Array.from({ length: 10 }, (_, index) => ({
              bright_id: `c-${index}`,
              data: { name: `Company ${index}` },
            })),
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            req_id: 'r1',
            meta: { matched: 12 },
            documents: [
              { bright_id: 'c-10', data: { name: 'Company 10' } },
              { bright_id: 'c-11', data: { name: 'Company 11' } },
            ],
          }),
      });

    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await service.search({
      entity: 'company',
      mode: 'Smart',
      query: 'Apparel brands in India',
      limit: 25,
    });

    expect(result.mode).toBe('smart');
    expect(result.documents).toHaveLength(12);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(
      (fetchMock.mock.calls[0][1] as { body: string }).body,
    );

    expect(firstBody).toMatchObject({
      source: 'linkedin_company',
      mode: 'smart',
      query: 'Apparel brands in India',
      offset: 0,
      limit: 10,
      view: 'full',
    });
  });

  it('should wait for Retry-After after a 429 and then succeed', async () => {
    jest.useFakeTimers();

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: () => '2' },
        text: async () => '{"error":"Too many search requests"}',
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => null },
        text: async () =>
          JSON.stringify({
            req_id: 'r',
            meta: { matched: 1 },
            documents: [{ bright_id: 'a', data: { name: 'A' } }],
          }),
      });

    global.fetch = fetchMock as unknown as typeof fetch;

    const search = service.search({
      entity: 'people',
      mode: 'instant',
      query: 'Rahil Gandhi',
      limit: 5,
    });

    await jest.advanceTimersByTimeAsync(1_900);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1_000);

    const result = await search;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.documents).toHaveLength(1);

    jest.useRealTimers();
  });

  describe('cache', () => {
    const store = new Map<string, unknown>();
    const cache = {
      get: jest.fn(async (key: string) => store.get(key)),
      set: jest.fn(async (key: string, value: unknown) => {
        store.set(key, value);
      }),
      del: jest.fn(),
    };
    // The real ledger, so the rows asserted below are the ones production writes
    const insert = jest.fn().mockResolvedValue(undefined);
    let cachedService: BrightDataBusinessSearchService;

    const page = (documents: Array<{ id: string }>) => ({
      ok: true,
      headers: { get: () => null },
      text: async () =>
        JSON.stringify({
          req_id: 'req-1',
          meta: { matched: documents.length },
          documents: documents.map((document) => ({
            bright_id: document.id,
            data: { name: document.id },
          })),
        }),
    });

    const ludicrousQuery = {
      and: [
        { in: { offices_country_codes: ['US', 'IN'] } },
        { text: { about: { value: 'fintech', mode: 'all' as const } } },
      ],
    };

    beforeEach(() => {
      store.clear();
      insert.mockClear();
      cache.get.mockClear();
      cache.set.mockClear();
      const providerCallLog = new ProviderCallLogService({ insert } as never);

      cachedService = new BrightDataBusinessSearchService(
        undefined,
        new ProviderQueryCacheService(
          cache as never,
          undefined,
          providerCallLog,
        ),
        providerCallLog,
      );
    });

    it('buys a page once and replays it to the next caller for free', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValue(page([{ id: 'a' }, { id: 'b' }]));

      global.fetch = fetchMock as unknown as typeof fetch;

      const first = await cachedService.searchPage({
        entity: 'company',
        query: ludicrousQuery,
        offset: 0,
        limit: 2,
        workspaceId: 'workspace-1',
      });
      const second = await cachedService.searchPage({
        entity: 'company',
        query: ludicrousQuery,
        offset: 0,
        limit: 2,
        workspaceId: 'workspace-1',
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(first.fromCache).toBe(false);
      expect(second.fromCache).toBe(true);
      expect(second.documents).toEqual(first.documents);

      // One billed request and one replay: the fetch row belongs to the fetch
      // itself, and the cache adds only the hit
      expect(insert.mock.calls.map(([row]) => row.cacheStatus)).toEqual([
        'uncached',
        'redis_hit',
      ]);
      expect(insert.mock.calls[0][0]).toMatchObject({
        provider: 'bright-data',
        operation: 'business-search:company',
        success: true,
        request: {
          entity: 'company',
          mode: 'ludicrous',
          query: ludicrousQuery,
          offset: 0,
          limit: 2,
        },
      });
      expect(insert.mock.calls[0][0].cacheKey).toMatch(
        /^bright-data-search-page:v1:[0-9a-f]{64}$/,
      );
      expect(insert.mock.calls[1][0].cacheKey).toBe(
        insert.mock.calls[0][0].cacheKey,
      );
    });

    it('treats the same filter written in another order as one request', async () => {
      const fetchMock = jest.fn().mockResolvedValue(page([{ id: 'a' }]));

      global.fetch = fetchMock as unknown as typeof fetch;

      await cachedService.searchPage({
        entity: 'company',
        query: ludicrousQuery,
        offset: 0,
        limit: 1,
      });

      const reordered = await cachedService.searchPage({
        entity: 'company',
        query: {
          and: [
            { text: { about: { value: 'fintech', mode: 'all' } } },
            { in: { offices_country_codes: ['IN', 'US'] } },
          ],
        },
        offset: 0,
        limit: 1,
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(reordered.fromCache).toBe(true);
    });

    it('keys an omitted limit as the page size it resolves to', async () => {
      const fetchMock = jest.fn().mockResolvedValue(page([{ id: 'a' }]));

      global.fetch = fetchMock as unknown as typeof fetch;

      await cachedService.search({
        entity: 'people',
        mode: 'instant',
        query: 'Rahil Gandhi',
      });

      const explicit = await cachedService.search({
        entity: 'people',
        mode: 'instant',
        query: 'Rahil Gandhi',
        limit: 100,
      });

      // instant pages at 100, so both calls ask Bright Data for the same thing
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(explicit.fromCache).toBe(true);
    });
  });
});
