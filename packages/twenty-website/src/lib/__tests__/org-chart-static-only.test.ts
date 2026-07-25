import {
    getOrgChartScraperCidrs,
    isClientIpInScraperCidrs,
    resolveOrgChartStaticOnly,
    shouldBlockOrgChartStaticChunkRequest,
} from '@/lib/org-chart-static-only';

describe('org-chart-static-only', () => {
  const originalScraperCidrs = process.env.ORG_CHART_SCRAPER_CIDRS;

  afterEach(() => {
    if (originalScraperCidrs === undefined) {
      delete process.env.ORG_CHART_SCRAPER_CIDRS;
    } else {
      process.env.ORG_CHART_SCRAPER_CIDRS = originalScraperCidrs;
    }
  });

  it('getOrgChartScraperCidrs uses defaults when env unset', () => {
    delete process.env.ORG_CHART_SCRAPER_CIDRS;
    expect(getOrgChartScraperCidrs()).toEqual([
      '43.173.0.0/16',
      '43.172.0.0/16',
    ]);
  });

  it('isClientIpInScraperCidrs matches configured CIDR', () => {
    process.env.ORG_CHART_SCRAPER_CIDRS = '10.0.0.0/8';
    expect(isClientIpInScraperCidrs('10.1.2.3')).toBe(true);
    expect(isClientIpInScraperCidrs('192.168.1.1')).toBe(false);
  });

  it('resolveOrgChartStaticOnly is true for verified bots', () => {
    expect(
      resolveOrgChartStaticOnly({
        headers: new Headers(),
        isVerifiedBot: true,
      }),
    ).toBe(true);
  });

  it('resolveOrgChartStaticOnly is true without browser signals', () => {
    expect(
      resolveOrgChartStaticOnly({
        headers: new Headers({ 'user-agent': 'curl/8.0' }),
        isVerifiedBot: false,
      }),
    ).toBe(true);
  });

  it('resolveOrgChartStaticOnly is true for scraper CIDR', () => {
    expect(
      resolveOrgChartStaticOnly({
        headers: new Headers({
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'sec-fetch-site': 'none',
          'sec-fetch-mode': 'navigate',
          'cloudfront-viewer-address': '43.173.1.2:12345',
        }),
        isVerifiedBot: false,
      }),
    ).toBe(true);
  });

  it('resolveOrgChartStaticOnly is false for likely browser outside scraper CIDR', () => {
    expect(
      resolveOrgChartStaticOnly({
        headers: new Headers({
          'user-agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'sec-fetch-site': 'same-origin',
          'sec-fetch-mode': 'navigate',
          'cloudfront-viewer-address': '77.75.78.165:12345',
        }),
        isVerifiedBot: false,
      }),
    ).toBe(false);
  });

  it('shouldBlockOrgChartStaticChunkRequest blocks scrapers without arx_static', () => {
    expect(
      shouldBlockOrgChartStaticChunkRequest({
        pathname: '/_next/static/chunks/16-abc.js',
        referer: 'https://arxena.com/org/stayvista',
        hasArxStaticCookie: false,
        headers: new Headers({
          'user-agent': 'python-requests/2.31.0',
        }),
      }),
    ).toBe(true);
  });

  it('shouldBlockOrgChartStaticChunkRequest allows real browsers without arx_static', () => {
    expect(
      shouldBlockOrgChartStaticChunkRequest({
        pathname: '/_next/static/chunks/16-abc.js',
        referer: 'https://arxena.com/org/stayvista',
        hasArxStaticCookie: false,
        headers: new Headers({
          'user-agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'sec-fetch-site': 'same-origin',
          'sec-fetch-mode': 'cors',
          'sec-ch-ua': '"Chromium";v="120", "Google Chrome";v="120"',
        }),
      }),
    ).toBe(false);
  });

  it('shouldBlockOrgChartStaticChunkRequest allows when arx_static cookie is present', () => {
    expect(
      shouldBlockOrgChartStaticChunkRequest({
        pathname: '/_next/static/chunks/16-abc.js',
        referer: 'https://arxena.com/org/stayvista',
        hasArxStaticCookie: true,
        headers: new Headers({
          'user-agent': 'python-requests/2.31.0',
        }),
      }),
    ).toBe(false);
  });
});
