import dns from 'node:dns/promises';

import {
    clearVerifiedSearchBotCacheForTests,
    isVerifiedBingbot,
    isVerifiedGooglebot,
    isVerifiedOpenAIBot,
    isVerifiedSearchBot,
} from '../verified-search-bot';

jest.mock('node:dns/promises', () => ({
  reverse: jest.fn(),
  resolve4: jest.fn(),
}));

const mockedDns = dns as jest.Mocked<typeof dns>;

describe('verified-search-bot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearVerifiedSearchBotCacheForTests();
    delete process.env.ORG_CHART_ALLOW_VERIFIED_BOTS;
    delete process.env.ORG_CHART_OPENAI_BOT_CIDRS;
  });

  it('isVerifiedGooglebot returns true when reverse and forward DNS match', async () => {
    mockedDns.reverse.mockResolvedValue(['crawl-66-249-66-1.googlebot.com']);
    mockedDns.resolve4.mockResolvedValue(['66.249.66.1']);

    await expect(isVerifiedGooglebot('66.249.66.1')).resolves.toBe(true);
  });

  it('isVerifiedGooglebot returns false when forward DNS does not match', async () => {
    mockedDns.reverse.mockResolvedValue(['crawl-66-249-66-1.googlebot.com']);
    mockedDns.resolve4.mockResolvedValue(['1.2.3.4']);

    await expect(isVerifiedGooglebot('66.249.66.1')).resolves.toBe(false);
  });

  it('isVerifiedBingbot returns true for search.msn.com hostnames', async () => {
    mockedDns.reverse.mockResolvedValue(['msnbot-157-55-39-1.search.msn.com']);
    mockedDns.resolve4.mockResolvedValue(['157.55.39.1']);

    await expect(isVerifiedBingbot('157.55.39.1')).resolves.toBe(true);
  });

  it('isVerifiedOpenAIBot matches configured CIDRs', async () => {
    process.env.ORG_CHART_OPENAI_BOT_CIDRS = '20.15.0.0/16';

    await expect(isVerifiedOpenAIBot('20.15.1.2')).resolves.toBe(true);
    await expect(isVerifiedOpenAIBot('8.8.8.8')).resolves.toBe(false);
  });

  it('isVerifiedSearchBot caches positive results', async () => {
    mockedDns.reverse.mockResolvedValue(['crawl-66-249-66-1.googlebot.com']);
    mockedDns.resolve4.mockResolvedValue(['66.249.66.1']);

    await expect(isVerifiedSearchBot('66.249.66.1')).resolves.toBe(true);
    await expect(isVerifiedSearchBot('66.249.66.1')).resolves.toBe(true);

    expect(mockedDns.reverse).toHaveBeenCalledTimes(1);
  });

  it('isVerifiedSearchBot returns false when ORG_CHART_ALLOW_VERIFIED_BOTS=0', async () => {
    process.env.ORG_CHART_ALLOW_VERIFIED_BOTS = '0';
    mockedDns.reverse.mockResolvedValue(['crawl-66-249-66-1.googlebot.com']);
    mockedDns.resolve4.mockResolvedValue(['66.249.66.1']);

    await expect(isVerifiedSearchBot('66.249.66.1')).resolves.toBe(false);
    expect(mockedDns.reverse).not.toHaveBeenCalled();
  });
});
