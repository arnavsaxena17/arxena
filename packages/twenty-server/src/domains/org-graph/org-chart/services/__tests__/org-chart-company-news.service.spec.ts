import { OrgChartCompanyNewsService } from '../org-chart-company-news.service';
import type { CompanyNewsStorage } from '../../schemas/company-news.schema';

describe('OrgChartCompanyNewsService', () => {
  const orgChartS3Service = {
    getCompanyNews: jest.fn(),
    saveCompanyNews: jest.fn(),
  };

  const brightDataSerpService = {
    isGoogleNewsConfigured: jest.fn().mockReturnValue(true),
    requestGoogleNewsJson: jest.fn(),
  };

  const brightDataBillingService = {
    validateCreditsOrThrow: jest.fn().mockResolvedValue(undefined),
    billSerpRequest: jest.fn().mockResolvedValue({ chargedUsd: 0.0015 }),
  };

  const creditsService = {
    assertCanSpend: jest.fn().mockResolvedValue(undefined),
    record: jest.fn().mockResolvedValue({
      recorded: true,
      chargedUsd: 0.01,
      creditsUsedMicro: 10_000,
    }),
  };

  const service = new OrgChartCompanyNewsService(
    orgChartS3Service as never,
    brightDataSerpService as never,
    brightDataBillingService as never,
    creditsService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    brightDataSerpService.isGoogleNewsConfigured.mockReturnValue(true);
  });

  it('merges news items by URL preferring the newest fetch', () => {
    const storage: CompanyNewsStorage = {
      companyId: 'acme',
      companyName: 'Acme Corp',
      updatedAt: '2026-07-12T12:00:00.000Z',
      fetches: [
        {
          fetchedAt: '2026-07-10T10:00:00.000Z',
          source: 'openai',
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
          source: 'bright_data',
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

  it('fetches via Bright Data by default and bills SERP credits', async () => {
    orgChartS3Service.getCompanyNews.mockResolvedValue(null);
    orgChartS3Service.saveCompanyNews.mockResolvedValue(undefined);
    brightDataSerpService.requestGoogleNewsJson.mockResolvedValue({
      news: [
        {
          link: 'https://example.com/news',
          title: 'Acme launches product',
          source: 'Reuters',
          date: '3 hours ago',
        },
      ],
    });

    const storage = await service.fetchAndStoreCompanyNews({
      companyId: 'acme',
      companyName: 'Acme Corp',
      location: 'NY',
      workspaceId: 'ws-1',
    });

    expect(
      brightDataBillingService.validateCreditsOrThrow,
    ).toHaveBeenCalledWith('ws-1');
    expect(brightDataSerpService.requestGoogleNewsJson).toHaveBeenCalledWith(
      'Acme Corp NY',
    );
    expect(brightDataBillingService.billSerpRequest).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      resourceContext: 'company_news',
      resourceId: 'acme',
      userWorkspaceId: undefined,
    });
    expect(creditsService.record).not.toHaveBeenCalled();
    expect(storage.fetches[0]?.source).toBe('bright_data');
    expect(storage.fetches[0]?.result.news_items).toEqual([
      {
        summary: 'Acme launches product (Reuters)',
        date: '3 hours ago',
        url: 'https://example.com/news',
      },
    ]);
  });
});
