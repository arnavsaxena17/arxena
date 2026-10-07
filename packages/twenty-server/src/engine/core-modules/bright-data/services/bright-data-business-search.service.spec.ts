import { BrightDataBusinessSearchService } from 'src/engine/core-modules/bright-data/services/bright-data-business-search.service';

describe('BrightDataBusinessSearchService', () => {
  const service = new BrightDataBusinessSearchService();

  beforeEach(() => {
    process.env.BRIGHT_DATA_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.BRIGHT_DATA_API_KEY;
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
});
