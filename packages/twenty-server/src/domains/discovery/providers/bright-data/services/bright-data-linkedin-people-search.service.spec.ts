import { BrightDataLinkedinPeopleSearchService } from './bright-data-linkedin-people-search.service';
import { BrightDataSerpService } from './bright-data-serp.service';

describe('BrightDataLinkedinPeopleSearchService', () => {
  let brightDataSerpService: jest.Mocked<BrightDataSerpService>;
  let service: BrightDataLinkedinPeopleSearchService;

  beforeEach(() => {
    brightDataSerpService = {
      createDatasetSnapshot: jest.fn(),
      pollDatasetSnapshotUntilReady: jest.fn(),
      requestSerpJson: jest.fn(),
    } as unknown as jest.Mocked<BrightDataSerpService>;

    service = new BrightDataLinkedinPeopleSearchService(brightDataSerpService);
  });

  it('parses Bright Data snapshot results, groups them by page, and dedupes by LinkedIn URL', async () => {
    brightDataSerpService.createDatasetSnapshot.mockResolvedValue({
      snapshotId: 'snapshot-1',
    });
    brightDataSerpService.pollDatasetSnapshotUntilReady.mockResolvedValue([
      {
        url: 'https://www.google.com/',
        general: {
          search_engine: 'google',
          results_cnt: 20,
        },
        pagination: [{ page: '2' }, { page: '3' }],
        organic: [
          {
            url: 'https://www.google.com/search?q=test',
            link: 'https://www.linkedin.com/in/jane-doe/',
            title: 'Jane Doe - Director',
            rank: 1,
          },
          {
            url: 'https://www.google.com/search?q=test&start=10',
            link: 'https://www.linkedin.com/in/john-smith/',
            title: 'John Smith - Manager',
            rank: 11,
          },
          {
            url: 'https://www.google.com/search?q=test&start=10',
            link: 'https://www.linkedin.com/in/jane-doe/',
            title: 'Jane Doe - Director',
            rank: 12,
          },
        ],
      },
    ]);

    const onPageFetched = jest.fn();

    const result = await service.fetchAllPeopleResults({
      engines: ['google'],
      urls: {},
      keywords: { google: '"Batliboi Ltd"' },
      includePaginatedHtml: true,
      onStatus: jest.fn(),
      onPageFetched,
    });

    expect(brightDataSerpService.createDatasetSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          {
            url: 'https://www.google.com/',
            keyword: '"Batliboi Ltd"',
          },
        ],
        includePaginatedHtml: true,
      }),
    );
    expect(result.candidates).toHaveLength(2);
    expect(result.engines).toEqual([
      {
        engine: 'google',
        pagesFetched: [1, 2],
        totalPagesAvailable: 3,
        totalResultsReported: 20,
      },
    ]);
    expect(onPageFetched).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        page: 1,
        totalUniqueResults: 1,
      }),
    );
    expect(onPageFetched).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        page: 2,
        totalUniqueResults: 2,
        newUniqueResultsInPage: 1,
      }),
    );
  });
});
