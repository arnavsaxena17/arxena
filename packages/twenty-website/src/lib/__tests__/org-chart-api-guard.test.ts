jest.mock('twenty-shared', () => ({
  isVerifiedSearchBot: jest.fn().mockResolvedValue(false),
  isLikelyBrowserRequest: jest.fn().mockReturnValue(false),
  ORG_CHART_VERIFIED_BOT_HEADER: 'x-org-chart-verified-bot',
}));

import {
  checkOrgChartApiGuard,
  resolveOrgChartRateLimitProfile,
} from '@/lib/org-chart-api-guard';

describe('org-chart-api-guard', () => {
  it('rate-limits published brand org pages at 60 per minute', () => {
    expect(resolveOrgChartRateLimitProfile('/org/acme-corp')).toBe('page');
    expect(resolveOrgChartRateLimitProfile('/org-chart/acme-corp')).toBe(
      'page',
    );
    expect(resolveOrgChartRateLimitProfile('/api/org/acme-corp')).toBe(
      'default',
    );
  });

  it('does not rate-limit image-proxy, avatars, or company-logo', () => {
    expect(
      resolveOrgChartRateLimitProfile(
        '/api/org-chart/image-proxy/images-2/host/path',
      ),
    ).toBeNull();
    expect(
      resolveOrgChartRateLimitProfile('/api/org-chart/company-logo/acme'),
    ).toBeNull();
    expect(
      resolveOrgChartRateLimitProfile(`/api/avatars/${'a'.repeat(64)}`),
    ).toBeNull();
  });

  const originalGuardMode = process.env.ORG_CHART_GUARD_MODE;

  afterEach(() => {
    if (originalGuardMode === undefined) {
      delete process.env.ORG_CHART_GUARD_MODE;
    } else {
      process.env.ORG_CHART_GUARD_MODE = originalGuardMode;
    }
    jest.restoreAllMocks();
  });

  it('does not log suspected_scraper for self-declared bot user agents', async () => {
    process.env.ORG_CHART_GUARD_MODE = 'log_only';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const headers = new Headers({
      'user-agent':
        'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
      'cloudfront-viewer-address': '157.55.39.10:12345',
    });

    const result = await checkOrgChartApiGuard(
      headers,
      '/api/org-chart/companies/acme',
    );

    expect(result.allowed).toBe(true);
    expect(
      warnSpy.mock.calls.some(([message]) =>
        String(message).includes('suspected_scraper'),
      ),
    ).toBe(false);
  });

  it('still logs suspected_scraper for chrome-like scrapers without bot in UA', async () => {
    process.env.ORG_CHART_GUARD_MODE = 'log_only';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const headers = new Headers({
      'user-agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      'cloudfront-viewer-address': '34.56.168.230:12345',
    });

    const result = await checkOrgChartApiGuard(
      headers,
      '/api/org-chart/companies/acme',
    );

    expect(result.allowed).toBe(true);
    expect(
      warnSpy.mock.calls.some(([message]) =>
        String(message).includes('suspected_scraper'),
      ),
    ).toBe(true);
  });
});
