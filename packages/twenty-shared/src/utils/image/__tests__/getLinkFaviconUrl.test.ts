import { getLinkFaviconUrl } from '@/utils/image/getLinkFaviconUrl';

const SERVER_BASE_URL = 'http://localhost:3000';

describe('getLinkFaviconUrl', () => {
  it('extracts the hostname and returns the company-logo proxy url', () => {
    expect(
      getLinkFaviconUrl('https://cool-company.com/about', SERVER_BASE_URL),
    ).toBe(
      'http://localhost:3000/org-chart/company-logo?website=cool-company.com',
    );
  });

  it('accepts a bare domain', () => {
    expect(getLinkFaviconUrl('twenty.com', SERVER_BASE_URL)).toBe(
      'http://localhost:3000/org-chart/company-logo?website=twenty.com',
    );
  });

  it('returns undefined for empty input', () => {
    expect(getLinkFaviconUrl('', SERVER_BASE_URL)).toBeUndefined();
    expect(getLinkFaviconUrl(null, SERVER_BASE_URL)).toBeUndefined();
  });
});
