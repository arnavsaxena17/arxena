import { BrightDataBusinessSearchService } from 'src/engine/core-modules/bright-data/services/bright-data-business-search.service';

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
});
