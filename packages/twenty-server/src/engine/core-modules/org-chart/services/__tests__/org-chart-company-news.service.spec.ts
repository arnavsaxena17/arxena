import { OrgChartCompanyNewsService } from '../org-chart-company-news.service';
import type { CompanyNewsStorage } from '../../schemas/company-news.schema';

describe('OrgChartCompanyNewsService', () => {
  const orgChartS3Service = {
    getCompanyNews: jest.fn(),
    saveCompanyNews: jest.fn(),
  };

  const service = new OrgChartCompanyNewsService(orgChartS3Service as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('merges news items by URL preferring the newest fetch', () => {
    const storage: CompanyNewsStorage = {
      companyId: 'acme',
      companyName: 'Acme Corp',
      updatedAt: '2026-07-12T12:00:00.000Z',
      fetches: [
        {
          fetchedAt: '2026-07-10T10:00:00.000Z',
          result: {
            company_name: 'Acme Corp',
            location: 'New York, NY',
            news_items: [
              {
                summary: 'Older story',
                date: '2026-06-01',
                url: 'https://example.com/old',
              },
            ],
            notes: 'Limited coverage',
          },
        },
        {
          fetchedAt: '2026-07-12T12:00:00.000Z',
          result: {
            company_name: 'Acme Corp',
            location: 'New York, NY',
            news_items: [
              {
                summary: 'Newer story',
                date: '2026-07-01',
                url: 'https://example.com/new',
              },
              {
                summary: 'Updated old story',
                date: '2026-06-15',
                url: 'https://example.com/old',
              },
            ],
            notes: 'Good coverage',
          },
        },
      ],
    };

    const merged = service.mergeNewsItemsFromStorage(storage);
    expect(merged).toHaveLength(2);
    expect(merged[0]?.url).toBe('https://example.com/new');
    expect(merged[1]?.url).toBe('https://example.com/old');
    expect(merged[1]?.summary).toBe('Updated old story');
    expect(merged[1]?.fetchedAt).toBe('2026-07-12T12:00:00.000Z');
  });

  it('returns empty list when storage is missing', () => {
    expect(service.mergeNewsItemsFromStorage(null)).toEqual([]);
  });
});
