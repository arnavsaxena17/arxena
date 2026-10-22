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
    delete process.env.BRIGHT_DATA_SERP_FALLBACK_PROXY_USERNAME;
    delete process.env.BRIGHT_DATA_SERP_FALLBACK_PROXY_PASSWORD;
    delete process.env.BRIGHT_DATA_FSERP_PROXY_USERNAME;
    delete process.env.BRIGHT_DATA_FSERP_PROXY_PASSWORD;
    delete process.env.BRIGHT_DATA_FSERP_PROXY_HOST;
    delete process.env.BRIGHT_DATA_FSERP_PROXY_PORT;
    service = new BrightDataSerpService();
  });

  it('isConfigured is false without API key', () => {
    expect(service.isConfigured()).toBe(false);
    expect(service.isGoogleNewsConfigured()).toBe(false);
  });

  it('isConfigured is true when BRIGHT_DATA_API_KEY is set', () => {
    process.env.BRIGHT_DATA_API_KEY = 'test-key';
    expect(new BrightDataSerpService().isConfigured()).toBe(true);
    expect(new BrightDataSerpService().isGoogleNewsConfigured()).toBe(true);
  });

  it('requestGoogleNewsJson uses the Fast SERP proxy with news headers', async () => {
    process.env.BRIGHT_DATA_SERP_PROXY_USERNAME =
      'brd-customer-hl_x-zone-serp_api';
    process.env.BRIGHT_DATA_SERP_PROXY_PASSWORD = 'secret';

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          news: [
            {
              link: 'https://example.com/n',
              title: 'Quake hits region',
              source: 'Example News',
              date: '1 hour ago',
            },
          ],
        }),
    }) as unknown as typeof fetch;

    const result = await new BrightDataSerpService().requestGoogleNewsJson(
      'earthquake',
    );

    expect(result.news?.[0]?.title).toBe('Quake hits region');
    expect(fetch).toHaveBeenCalledWith(
      'https://www.google.com/search?q=earthquake&tbm=nws&brd_json=1&hl=en&gl=us',
      expect.objectContaining({
        method: 'GET',
        headers: {
          'x-unblock-data-format': 'parsed_light',
          'x-unblock-img-format': 'link',
        },
        dispatcher: expect.anything(),
      }),
    );
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

  describe('route fallback', () => {
    type Routes = {
      requestSerpJsonViaApi: jest.Mock;
      requestSerpJsonViaProxy: jest.Mock;
    };
    const searchUrl = 'https://www.google.com/search?q=test';
    const answer = { organic: [{ link: 'https://example.com/a' }] };

    const configureRoutes = (api: jest.Mock, proxy: jest.Mock) => {
      process.env.BRIGHT_DATA_API_KEY = 'test-key';
      process.env.BRIGHT_DATA_SERP_FALLBACK_PROXY_USERNAME =
        'brd-customer-hl_x-zone-serp_api_full_json';
      process.env.BRIGHT_DATA_SERP_FALLBACK_PROXY_PASSWORD = 'secret';

      const configured = new BrightDataSerpService();
      const routes = configured as unknown as Routes;

      routes.requestSerpJsonViaApi = api;
      routes.requestSerpJsonViaProxy = proxy;

      return configured;
    };

    it('should use the fallback proxy zone when the API cannot connect', async () => {
      const api = jest.fn().mockRejectedValue(new Error('fetch failed'));
      const proxy = jest.fn().mockResolvedValue(answer);
      const result = await configureRoutes(api, proxy).requestSerpJson(
        searchUrl,
      );

      expect(result).toBe(answer);
      expect(api).toHaveBeenCalledTimes(1);
      expect(proxy).toHaveBeenCalledTimes(1);
    });

    it('should not fall back on a rejected request', async () => {
      const api = jest.fn().mockRejectedValue(new Error('HTTP 400 bad query'));
      const proxy = jest.fn().mockResolvedValue(answer);

      await expect(
        configureRoutes(api, proxy).requestSerpJson(searchUrl),
      ).rejects.toThrow('HTTP 400');
      expect(proxy).not.toHaveBeenCalled();
    });

    it('should not resend a query Bright Data answered with a 502 to the next route', async () => {
      const api = jest.fn().mockRejectedValue(new Error('HTTP 502 rejected'));
      const proxy = jest.fn().mockResolvedValue(answer);

      await expect(
        configureRoutes(api, proxy).requestSerpJson(searchUrl),
      ).rejects.toThrow('HTTP 502');
      expect(proxy).not.toHaveBeenCalled();
    });

    it('should fall back when the zone credentials are refused', async () => {
      const api = jest.fn().mockRejectedValue(new Error('HTTP 407 auth'));
      const proxy = jest.fn().mockResolvedValue(answer);
      const result = await configureRoutes(api, proxy).requestSerpJson(
        searchUrl,
      );

      expect(result).toBe(answer);
    });

    it('should throw the last error when every route fails', async () => {
      const api = jest.fn().mockRejectedValue(new Error('fetch failed'));
      const proxy = jest.fn().mockRejectedValue(new Error('HTTP 502 upstream'));

      await expect(
        configureRoutes(api, proxy).requestSerpJson(searchUrl),
      ).rejects.toThrow('HTTP 502');
    });
  });

  describe('query cooldown and sharing', () => {
    const searchUrl = 'https://www.google.com/search?q=cooldown';
    const answer = { organic: [{ link: 'https://example.com/a' }] };
    const withApi = (api: jest.Mock) => {
      process.env.BRIGHT_DATA_API_KEY = 'test-key';

      const configured = new BrightDataSerpService();

      (
        configured as unknown as { requestSerpJsonViaApi: jest.Mock }
      ).requestSerpJsonViaApi = api;

      return configured;
    };

    it('should send identical concurrent queries once and share the answer', async () => {
      const api = jest.fn().mockResolvedValue(answer);
      const configured = withApi(api);
      const [first, second] = await Promise.all([
        configured.requestSerpJson(searchUrl),
        configured.requestSerpJson(searchUrl),
      ]);

      expect(first).toBe(answer);
      expect(second).toBe(answer);
      expect(api).toHaveBeenCalledTimes(1);
    });

    it('should wait out the cooldown before sending a failed query again', async () => {
      jest.useFakeTimers();

      const api = jest
        .fn()
        .mockRejectedValueOnce(new Error('HTTP 502 rejected'))
        .mockResolvedValueOnce(answer);
      const configured = withApi(api);

      await expect(configured.requestSerpJson(searchUrl)).rejects.toThrow(
        'HTTP 502',
      );

      const retry = configured.requestSerpJson(searchUrl);

      await jest.advanceTimersByTimeAsync(10_000);
      expect(api).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(7_000);
      await expect(retry).resolves.toBe(answer);
      expect(api).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('should stop waiting for a shared query when the caller aborts', async () => {
      const api = jest.fn(() => new Promise(() => undefined));
      const controller = new AbortController();
      const waiting = withApi(api as unknown as jest.Mock).requestSerpJson(
        searchUrl,
        { signal: controller.signal },
      );

      controller.abort();

      await expect(waiting).rejects.toThrow('aborted');
    });
  });
});
