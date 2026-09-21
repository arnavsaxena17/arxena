import { HttpException, HttpStatus } from '@nestjs/common';

import { LocalBusinessDataClient } from 'src/engine/core-modules/local-business-data/local-business-data.client';

describe('LocalBusinessDataClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  const createClient = (config: Record<string, string | undefined> = {}) => {
    const twentyConfigService = {
      get: jest.fn((key: string) => {
        if (key in config) {
          return config[key];
        }
        if (key === 'RAPIDAPI_KEY') {
          return 'test-key';
        }
        if (key === 'RAPIDAPI_LOCAL_BUSINESS_DATA_HOST') {
          return undefined;
        }

        return undefined;
      }),
    };

    return new LocalBusinessDataClient(twentyConfigService as never);
  };

  it('throws when RAPIDAPI_KEY is missing', async () => {
    const client = createClient({ RAPIDAPI_KEY: undefined });

    await expect(client.get('/search', { query: 'hotels' })).rejects.toThrow(
      HttpException,
    );
  });

  it('unwraps OK responses and returns data', async () => {
    const client = createClient();

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          status: 'OK',
          data: [{ name: 'Hilton' }],
        }),
    }) as unknown as typeof fetch;

    const result = await client.get('/search', { query: 'hotels', limit: 1 });

    expect(result).toEqual([{ name: 'Hilton' }]);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        'https://local-business-data.p.rapidapi.com/search?',
      ),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'X-RapidAPI-Key': 'test-key',
          'X-RapidAPI-Host': 'local-business-data.p.rapidapi.com',
        }),
      }),
    );
  });

  it('maps API ERROR status into HttpException', async () => {
    const client = createClient();

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          status: 'ERROR',
          error: { message: 'Missing query', code: 400 },
        }),
    }) as unknown as typeof fetch;

    await expect(client.get('/search', {})).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      message: 'Missing query',
    });
  });

  it('maps RapidAPI gateway errors', async () => {
    const client = createClient();

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () =>
        JSON.stringify({ message: 'You are not subscribed to this API.' }),
    }) as unknown as typeof fetch;

    await expect(client.get('/search', { query: 'x' })).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
      message: 'You are not subscribed to this API.',
    });
  });
});
