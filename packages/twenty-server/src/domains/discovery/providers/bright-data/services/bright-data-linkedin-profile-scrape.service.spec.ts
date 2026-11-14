import { BrightDataLinkedinProfileScrapeService } from './bright-data-linkedin-profile-scrape.service';

describe('BrightDataLinkedinProfileScrapeService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
    delete process.env.BRIGHT_DATA_API_KEY;
    delete process.env.BRIGHT_DATA_LINKEDIN_PROFILE_DATASET_ID;
    delete process.env.BRIGHT_DATA_SNAPSHOT_POLL_INTERVAL_MS;
    delete process.env.BRIGHT_DATA_LINKEDIN_PROFILE_SNAPSHOT_TIMEOUT_MS;
  });

  it('isConfigured is true when BRIGHT_DATA_API_KEY is set', () => {
    process.env.BRIGHT_DATA_API_KEY = 'test-key';
    expect(new BrightDataLinkedinProfileScrapeService().isConfigured()).toBe(
      true,
    );
  });

  it('scrapeProfilesByUrl returns records on HTTP 200', async () => {
    process.env.BRIGHT_DATA_API_KEY = 'test-key';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify([
          {
            name: 'Devanshu G.',
            input_url: 'https://in.linkedin.com/in/devanshugandhi',
            about: 'Managing Director',
            followers: 100,
          },
        ]),
    });

    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new BrightDataLinkedinProfileScrapeService();
    const records = await service.scrapeProfilesByUrl([
      'https://in.linkedin.com/in/devanshugandhi',
    ]);

    expect(records).toHaveLength(1);
    expect(records[0].name).toBe('Devanshu G.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      'dataset_id=gd_l1viktl72bvl7bjuj0',
    );
  });

  it('scrapeProfilesByUrl polls and downloads when sync scrape returns HTTP 202 snapshot_id', async () => {
    jest.useFakeTimers();
    process.env.BRIGHT_DATA_API_KEY = 'test-key';
    process.env.BRIGHT_DATA_SNAPSHOT_POLL_INTERVAL_MS = '10000';

    const snapshotId = 'sd_mvij6xwjkqscfz4cq';
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 202,
        text: async () =>
          JSON.stringify({
            snapshot_id: snapshotId,
            message: 'still in progress',
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ snapshot_id: snapshotId, status: 'running' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ snapshot_id: snapshotId, status: 'ready' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify([
            {
              name: 'Devanshu G.',
              input_url: 'https://in.linkedin.com/in/devanshugandhi',
              about: 'Managing Director',
              followers: 100,
            },
          ]),
      });

    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new BrightDataLinkedinProfileScrapeService();
    const recordsPromise = service.scrapeProfilesByUrl([
      'https://in.linkedin.com/in/devanshugandhi',
      'https://in.linkedin.com/in/pradeep-g-pai-20852b32',
    ]);

    await jest.runAllTimersAsync();
    const records = await recordsPromise;

    expect(records).toHaveLength(1);
    expect(records[0].name).toBe('Devanshu G.');
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(String(fetchMock.mock.calls[1][0])).toContain(
      `/datasets/v3/progress/${snapshotId}`,
    );
    expect(String(fetchMock.mock.calls[3][0])).toContain(
      `/datasets/v3/snapshot/${snapshotId}?format=json`,
    );

    jest.useRealTimers();
  });
});
