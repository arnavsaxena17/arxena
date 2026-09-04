import {
  extractOrgChartCompanyKeyFromPath,
  isOrgChartCrawlStaticOnly,
  recordOrgChartCompanyView,
  resetOrgChartCrawlStaticStateForTests,
} from '@/lib/org-chart-crawl-static';

describe('org-chart-crawl-static', () => {
  const originalUniqueMax = process.env.ORG_CHART_CRAWL_UNIQUE_PAGES_MAX;
  const originalWindowMs = process.env.ORG_CHART_CRAWL_WINDOW_MS;
  const originalTtlMs = process.env.ORG_CHART_CRAWL_STATIC_TTL_MS;

  beforeEach(() => {
    resetOrgChartCrawlStaticStateForTests();
    process.env.ORG_CHART_CRAWL_UNIQUE_PAGES_MAX = '3';
    process.env.ORG_CHART_CRAWL_WINDOW_MS = '60000';
    process.env.ORG_CHART_CRAWL_STATIC_TTL_MS = '900000';
  });

  afterEach(() => {
    resetOrgChartCrawlStaticStateForTests();
    if (originalUniqueMax === undefined) {
      delete process.env.ORG_CHART_CRAWL_UNIQUE_PAGES_MAX;
    } else {
      process.env.ORG_CHART_CRAWL_UNIQUE_PAGES_MAX = originalUniqueMax;
    }
    if (originalWindowMs === undefined) {
      delete process.env.ORG_CHART_CRAWL_WINDOW_MS;
    } else {
      process.env.ORG_CHART_CRAWL_WINDOW_MS = originalWindowMs;
    }
    if (originalTtlMs === undefined) {
      delete process.env.ORG_CHART_CRAWL_STATIC_TTL_MS;
    } else {
      process.env.ORG_CHART_CRAWL_STATIC_TTL_MS = originalTtlMs;
    }
  });

  it('extracts company keys from org-chart, org, and embed paths', () => {
    expect(extractOrgChartCompanyKeyFromPath('/org-chart/google')).toBe(
      'google',
    );
    expect(
      extractOrgChartCompanyKeyFromPath('/org-chart/google/united-states'),
    ).toBe('google');
    expect(extractOrgChartCompanyKeyFromPath('/org/acme-corp')).toBe(
      'acme-corp',
    );
    expect(
      extractOrgChartCompanyKeyFromPath('/embed/org-chart/netflix'),
    ).toBe('netflix');
    expect(extractOrgChartCompanyKeyFromPath('/org-chart')).toBeNull();
    expect(
      extractOrgChartCompanyKeyFromPath('/org-chart/share/token-1'),
    ).toBeNull();
  });

  it('does not flag an IP under the unique-page threshold', () => {
    expect(recordOrgChartCompanyView('1.1.1.1', 'google')).toBe(false);
    expect(recordOrgChartCompanyView('1.1.1.1', 'netflix')).toBe(false);
    expect(isOrgChartCrawlStaticOnly('1.1.1.1')).toBe(false);
  });

  it('flags an IP that hits enough unique company pages', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(recordOrgChartCompanyView('2.2.2.2', 'google')).toBe(false);
    expect(recordOrgChartCompanyView('2.2.2.2', 'netflix')).toBe(false);
    expect(recordOrgChartCompanyView('2.2.2.2', 'apple')).toBe(true);
    expect(isOrgChartCrawlStaticOnly('2.2.2.2')).toBe(true);
    expect(
      warnSpy.mock.calls.some(([message]) =>
        String(message).includes('crawl_static_only'),
      ),
    ).toBe(true);
    warnSpy.mockRestore();
  });

  it('does not count repeats of the same company toward the threshold', () => {
    expect(recordOrgChartCompanyView('3.3.3.3', 'google')).toBe(false);
    expect(recordOrgChartCompanyView('3.3.3.3', 'google')).toBe(false);
    expect(recordOrgChartCompanyView('3.3.3.3', 'google')).toBe(false);
    expect(isOrgChartCrawlStaticOnly('3.3.3.3')).toBe(false);
  });
});
