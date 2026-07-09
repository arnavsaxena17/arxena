import {
  clearVerifiedSearchBotCacheForTests,
  isVerifiedBingbot,
  isVerifiedGooglebot,
  isVerifiedOpenAIBot,
  isVerifiedSearchBot,
} from '../verified-search-bot';

const mockDnsJson = (answers: string[]) =>
  Promise.resolve({
    ok: true,
    json: async () => ({
      Answer: answers.map((data) => ({ data })),
    }),
  } as Response);

describe('verified-search-bot', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    clearVerifiedSearchBotCacheForTests();
    delete process.env.ORG_CHART_ALLOW_VERIFIED_BOTS;
    delete process.env.ORG_CHART_OPENAI_BOT_CIDRS;
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('isVerifiedGooglebot returns true when reverse and forward DNS match', async () => {
    fetchMock
      .mockResolvedValueOnce(
        mockDnsJson(['crawl-66-249-66-1.googlebot.com.']),
      )
      .mockResolvedValueOnce(mockDnsJson(['66.249.66.1']));

    await expect(isVerifiedGooglebot('66.249.66.1')).resolves.toBe(true);
  });

  it('isVerifiedGooglebot returns false when forward DNS does not match', async () => {
    fetchMock
      .mockResolvedValueOnce(
        mockDnsJson(['crawl-66-249-66-1.googlebot.com.']),
      )
      .mockResolvedValueOnce(mockDnsJson(['1.2.3.4']));

    await expect(isVerifiedGooglebot('66.249.66.1')).resolves.toBe(false);
  });

  it('isVerifiedBingbot returns true for search.msn.com hostnames', async () => {
    fetchMock
      .mockResolvedValueOnce(
        mockDnsJson(['msnbot-157-55-39-1.search.msn.com.']),
      )
      .mockResolvedValueOnce(mockDnsJson(['157.55.39.1']));

    await expect(isVerifiedBingbot('157.55.39.1')).resolves.toBe(true);
  });

  it('isVerifiedOpenAIBot matches configured CIDRs', async () => {
    process.env.ORG_CHART_OPENAI_BOT_CIDRS = '20.15.0.0/16';

    await expect(isVerifiedOpenAIBot('20.15.1.2')).resolves.toBe(true);
    await expect(isVerifiedOpenAIBot('8.8.8.8')).resolves.toBe(false);
  });

  it('isVerifiedSearchBot caches positive results', async () => {
    fetchMock
      .mockResolvedValueOnce(
        mockDnsJson(['crawl-66-249-66-1.googlebot.com.']),
      )
      .mockResolvedValueOnce(mockDnsJson(['66.249.66.1']));

    await expect(isVerifiedSearchBot('66.249.66.1')).resolves.toBe(true);
    await expect(isVerifiedSearchBot('66.249.66.1')).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('isVerifiedSearchBot returns false when ORG_CHART_ALLOW_VERIFIED_BOTS=0', async () => {
    process.env.ORG_CHART_ALLOW_VERIFIED_BOTS = '0';
    fetchMock.mockResolvedValueOnce(
      mockDnsJson(['crawl-66-249-66-1.googlebot.com.']),
    );

    await expect(isVerifiedSearchBot('66.249.66.1')).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
