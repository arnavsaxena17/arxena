import { CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { EnvironmentService } from 'src/engine/core-modules/environment/environment.service';
import { PdlAutocompleteService } from 'src/engine/core-modules/org-chart/services/pdl-autocomplete.service';

const PDL_COMPANY_HIT = {
  name: 'Acme',
  count: 12,
  meta: {
    id: 'acme',
    linkedin_slug: 'acme',
    website: 'acme.com',
  },
};

describe('PdlAutocompleteService key rotation', () => {
  let service: PdlAutocompleteService;
  let environmentValues: Record<string, string | undefined>;
  let cacheStore: Map<string, unknown>;
  let fetchMock: jest.Mock;

  const createService = () => {
    const environmentService = {
      get: jest.fn((key: string) => environmentValues[key]),
    };
    const cacheStorage = {
      get: jest.fn(async (key: string) => cacheStore.get(key)),
      set: jest.fn(async (key: string, value: unknown) => {
        cacheStore.set(key, value);
      }),
    };

    return new PdlAutocompleteService(
      environmentService as unknown as EnvironmentService,
      cacheStorage as unknown as CacheStorageService,
    );
  };

  beforeEach(() => {
    environmentValues = {
      PARAG_PDL_API_KEY: 'parag-key',
      ARXENACO_PDL_API_KEY: 'arxenaco-key',
      RAVI_PDL_API_KEY: 'ravi-key',
      JAWAHAR_PDL_API_KEY: 'jawahar-key',
      PDL_API_KEY: 'legacy-key',
    };
    cacheStore = new Map();
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    service = createService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('retries the next shared key after a 429', async () => {
    fetchMock
      .mockResolvedValueOnce({
        status: 429,
        ok: false,
      })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({ data: [PDL_COMPANY_HIT] }),
      });

    const results = await service.getCompanyAutocomplete('acme');

    expect(results).toEqual([
      {
        name: 'Acme',
        meta: {
          id: 'acme',
          linkedin_slug: 'acme',
          website: 'acme.com',
          industry: undefined,
          location_name: undefined,
        },
        count: 12,
      },
    ]);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Api-Key': 'parag-key' }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Api-Key': 'arxenaco-key' }),
      }),
    );
  });

  it('does not use the reserved twenty-front key for public autocomplete', async () => {
    fetchMock.mockResolvedValue({
      status: 429,
      ok: false,
    });

    await service.getCompanyAutocomplete('acme');

    const usedKeys = fetchMock.mock.calls.map(
      (call) =>
        (call[1] as { headers: Record<string, string> }).headers['X-Api-Key'],
    );

    expect(usedKeys).toEqual([
      'parag-key',
      'arxenaco-key',
      'ravi-key',
      'legacy-key',
    ]);
    expect(usedKeys).not.toContain('jawahar-key');
  });

  it('uses the reserved key last for twenty-front autocomplete', async () => {
    fetchMock.mockResolvedValue({
      status: 429,
      ok: false,
    });

    await service.getCompanyAutocomplete('acme', {
      includeTwentyFrontReservedKey: true,
    });

    const usedKeys = fetchMock.mock.calls.map(
      (call) =>
        (call[1] as { headers: Record<string, string> }).headers['X-Api-Key'],
    );

    expect(usedKeys.at(-1)).toBe('jawahar-key');
  });

  it('skips a key that is already cooling down', async () => {
    fetchMock
      .mockResolvedValueOnce({
        status: 429,
        ok: false,
      })
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => ({ data: [PDL_COMPANY_HIT] }),
      });

    await service.getCompanyAutocomplete('acme');
    fetchMock.mockClear();
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ data: [PDL_COMPANY_HIT] }),
    });

    await service.getCompanyAutocomplete('beta');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Api-Key': 'arxenaco-key' }),
      }),
    );
  });

  it('reports cooling down only when every key in the pool is limited', async () => {
    fetchMock.mockResolvedValue({
      status: 429,
      ok: false,
    });

    expect(await service.isCoolingDown()).toBe(false);

    await service.getCompanyAutocomplete('acme');

    expect(await service.isCoolingDown()).toBe(true);
    expect(await service.isCoolingDown(true)).toBe(false);
  });
});
