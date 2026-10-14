import { BrightDataSerpService } from './bright-data-serp.service';

describe('BrightDataSerpService', () => {
  let service: BrightDataSerpService;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.BRIGHT_DATA_API_KEY;
    delete process.env.BRIGHT_DATA_SERP_ZONE;
    delete process.env.BRIGHT_DATA_SERP_ASYNC;
    delete process.env.BRIGHT_DATA_SERP_PROXY_USERNAME;
    delete process.env.BRIGHT_DATA_SERP_PROXY_PASSWORD;
    delete process.env.BRIGHT_DATA_SERP_ASYNC_POLL_INTERVAL_MS;
    service = new BrightDataSerpService();
  });

  it('isConfigured is false without API key', () => {
    expect(service.isConfigured()).toBe(false);
  });

  it('isConfigured is true when BRIGHT_DATA_API_KEY is set', () => {
    process.env.BRIGHT_DATA_API_KEY = 'test-key';
    expect(new BrightDataSerpService().isConfigured()).toBe(true);
  });

  it('submits an async SERP job and polls until the result is ready', async () => {
    process.env.BRIGHT_DATA_API_KEY = 'test-key';
    process.env.BRIGHT_DATA_SERP_ASYNC = 'true';
    process.env.BRIGHT_DATA_SERP_ASYNC_POLL_INTERVAL_MS = '1';
    jest.useRealTimers();

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => JSON.stringify({ response_id: 'job-1' }),
      })
      .mockResolvedValueOnce({ ok: true, status: 202, text: async () => '' })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ organic: [{ link: 'https://example.com/a' }] }),
      }) as unknown as typeof fetch;

    const result = await new BrightDataSerpService().requestSerpGoogleJson(
      'https://www.google.com/search?q=pizza&hl=en&num=10',
    );

    jest.useFakeTimers();

    expect(result.organic?.[0]?.link).toBe('https://example.com/a');
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://api.brightdata.com/serp/req?zone=serp_api',
      expect.objectContaining({
        body: JSON.stringify({
          query: { q: 'pizza', hl: 'en', num: '10' },
          brd_json: 'json',
        }),
      }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      'https://api.brightdata.com/serp/get_result?response_id=job-1&zone=serp_api',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('requests Google through the native proxy when proxy credentials are set', async () => {
    process.env.BRIGHT_DATA_SERP_PROXY_USERNAME =
      'brd-customer-hl_x-zone-serp_api';
    process.env.BRIGHT_DATA_SERP_PROXY_PASSWORD = 'secret';

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ organic: [{ link: 'https://example.com/p' }] }),
    }) as unknown as typeof fetch;

    const proxied = new BrightDataSerpService();
    const result = await proxied.requestSerpGoogleJson(
      'https://www.google.com/search?q=pizza',
      { dataFormat: 'parsed_light' },
    );

    expect(proxied.isConfigured()).toBe(true);
    expect(result.organic?.[0]?.link).toBe('https://example.com/p');
    expect(fetch).toHaveBeenCalledWith(
      'https://www.google.com/search?q=pizza',
      expect.objectContaining({
        method: 'GET',
        headers: { 'x-unblock-data-format': 'parsed_light' },
        dispatcher: expect.anything(),
      }),
    );
  });

  it('requestSerpGoogleJson posts to Bright Data and parses organic JSON', async () => {
    process.env.BRIGHT_DATA_API_KEY = 'test-key';

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          organic: [
            { link: 'https://theorg.com/org/acme-corp', global_rank: 1 },
          ],
        }),
    }) as unknown as typeof fetch;

    const result = await service.requestSerpGoogleJson(
      'https://www.google.com/search?q=test',
    );

    expect(result.organic?.[0]?.link).toBe('https://theorg.com/org/acme-corp');
    expect(fetch).toHaveBeenCalledWith(
      'https://api.brightdata.com/request',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      }),
    );
  });

  it('requestSerpGoogleJson throws when Bright Data wraps an upstream failure in a 200', async () => {
    process.env.BRIGHT_DATA_API_KEY = 'test-key';

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({ status_code: 502, headers: {}, body: '' }),
    }) as unknown as typeof fetch;

    await expect(
      service.requestSerpGoogleJson('https://www.google.com/search?q=test'),
    ).rejects.toThrow('HTTP 502');
  });

  it('requestSerpGoogleJson throws when Bright Data answers a 200 with plain text', async () => {
    process.env.BRIGHT_DATA_API_KEY = 'test-key';

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => 'The request was rejected, please try again later',
    }) as unknown as typeof fetch;

    await expect(
      service.requestSerpGoogleJson('https://www.google.com/search?q=test'),
    ).rejects.toThrow('non-JSON reply: The request was rejected');
  });

  it('requestSerpGoogleJson unwraps stringified body when present', async () => {
    process.env.BRIGHT_DATA_API_KEY = 'test-key';

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          body: JSON.stringify({
            organic: [{ link: 'https://theorg.com/org/wrapped' }],
          }),
        }),
    }) as unknown as typeof fetch;

    const result = await service.requestSerpGoogleJson(
      'https://www.google.com/search?q=test',
    );

    expect(result.organic?.[0]?.link).toBe('https://theorg.com/org/wrapped');
  });
});
