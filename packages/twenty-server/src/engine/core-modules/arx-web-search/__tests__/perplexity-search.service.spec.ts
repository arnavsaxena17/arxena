import { PerplexitySearchService } from 'src/engine/core-modules/arx-web-search/perplexity-search.service';

const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

describe('PerplexitySearchService', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.useFakeTimers();
    process.env.PERPLEXITY_API_KEY = 'test-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.PERPLEXITY_API_KEY;
    jest.useRealTimers();
  });

  it('should turn search results into evidence and bill the configured price', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        results: [
          {
            title: 'Swiggy Employees',
            url: 'https://example.com',
            snippet: 'Swiggy had 5,321 employees as of March 31, 2026.',
          },
          { title: 'Empty snippet', url: 'https://e.com', snippet: '' },
        ],
      }),
    );

    global.fetch = fetchMock as never;

    const evidence = await new PerplexitySearchService().search('swiggy');

    expect(evidence).toMatchObject({ provider: 'perplexity', costUsd: 0.005 });
    expect(evidence?.snippets).toHaveLength(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      query: 'swiggy',
      search_type: 'fast',
    });
  });

  it('should retry a 429 once and give up immediately on an auth error', async () => {
    const rateLimited = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, {}))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          results: [{ title: 'T', url: 'u', snippet: 'S' }],
        }),
      );

    global.fetch = rateLimited as never;

    const promise = new PerplexitySearchService().search('q');

    await jest.runAllTimersAsync();

    await expect(promise).resolves.not.toBeNull();
    expect(rateLimited).toHaveBeenCalledTimes(2);

    const unauthorized = jest.fn().mockResolvedValue(jsonResponse(401, {}));

    global.fetch = unauthorized as never;

    await expect(new PerplexitySearchService().search('q')).resolves.toBeNull();
    expect(unauthorized).toHaveBeenCalledTimes(1);
  });
});
