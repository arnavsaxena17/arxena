import { BrightDataSerpService } from './bright-data-serp.service';

describe('BrightDataSerpService', () => {
  let service: BrightDataSerpService;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.BRIGHT_DATA_API_KEY;
    delete process.env.BRIGHT_DATA_SERP_ZONE;
    service = new BrightDataSerpService();
  });

  it('isConfigured is false without API key', () => {
    expect(service.isConfigured()).toBe(false);
  });

  it('isConfigured is true when BRIGHT_DATA_API_KEY is set', () => {
    process.env.BRIGHT_DATA_API_KEY = 'test-key';
    expect(new BrightDataSerpService().isConfigured()).toBe(true);
  });

  it('requestSerpGoogleJson posts to Bright Data and parses organic JSON', async () => {
    process.env.BRIGHT_DATA_API_KEY = 'test-key';

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          organic: [{ link: 'https://theorg.com/org/acme-corp', global_rank: 1 }],
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
