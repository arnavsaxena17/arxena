import { BrightDataGoogleMapsPlacesService } from './bright-data-google-maps-places.service';

describe('BrightDataGoogleMapsPlacesService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.BRIGHT_DATA_API_KEY;
    delete process.env.BRIGHT_DATA_GOOGLE_MAPS_DATASET_ID;
  });

  it('isConfigured is true when BRIGHT_DATA_API_KEY is set', () => {
    process.env.BRIGHT_DATA_API_KEY = 'test-key';
    expect(new BrightDataGoogleMapsPlacesService().isConfigured()).toBe(true);
  });

  it('discoverByLocation posts discover_by=location for small batches', async () => {
    process.env.BRIGHT_DATA_API_KEY = 'test-key';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify([
          {
            place_id: 'ChIJExample',
            name: 'Test Cafe',
            address: 'Mumbai',
          },
        ]),
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new BrightDataGoogleMapsPlacesService();
    const records = await service.discoverByLocation([
      {
        country: 'IN',
        lat: 19.076,
        long: 72.8777,
        zoom_level: 12,
        keyword: 'qsr',
      },
    ]);

    expect(records).toHaveLength(1);
    expect(records[0].place_id).toBe('ChIJExample');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const calledUrl = String(fetchMock.mock.calls[0][0]);

    expect(calledUrl).toContain('dataset_id=gd_m8ebnr0q2qlklc02fz');
    expect(calledUrl).toContain('type=discover_new');
    expect(calledUrl).toContain('discover_by=location');
  });
});
