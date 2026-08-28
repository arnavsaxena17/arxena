import {
  getLogoUrlFromDomainName,
  sanitizeURL,
} from '@/utils/image/getLogoUrlFromDomainName';

const SERVER_BASE_URL = 'http://localhost:3000';

const expectedLogoUrl = (domain: string) =>
  `${SERVER_BASE_URL}/org-chart/company-logo/${encodeURIComponent(domain)}`;

describe('sanitizeURL', () => {
  test('should sanitize the URL correctly', () => {
    expect(sanitizeURL('http://example.com/')).toBe('example.com');
    expect(sanitizeURL('https://www.example.com/')).toBe('example.com');
    expect(sanitizeURL('www.example.com')).toBe('example.com');
    expect(sanitizeURL('example.com')).toBe('example.com');
    expect(sanitizeURL('example.com/')).toBe('example.com');
  });

  test('should handle undefined input', () => {
    expect(sanitizeURL(undefined)).toBe('');
  });
});

describe('getLogoUrlFromDomainName', () => {
  test('should return the company-logo proxy URL for a given domain', () => {
    expect(getLogoUrlFromDomainName('example.com', SERVER_BASE_URL)).toBe(
      expectedLogoUrl('example.com'),
    );

    expect(
      getLogoUrlFromDomainName('http://example.com/', SERVER_BASE_URL),
    ).toBe(expectedLogoUrl('example.com'));

    expect(
      getLogoUrlFromDomainName('https://www.example.com/', SERVER_BASE_URL),
    ).toBe(expectedLogoUrl('example.com'));

    expect(getLogoUrlFromDomainName('www.example.com', SERVER_BASE_URL)).toBe(
      expectedLogoUrl('example.com'),
    );

    expect(getLogoUrlFromDomainName('example.com/', SERVER_BASE_URL)).toBe(
      expectedLogoUrl('example.com'),
    );

    expect(getLogoUrlFromDomainName('apple.com', SERVER_BASE_URL)).toBe(
      expectedLogoUrl('apple.com'),
    );
  });

  test('should handle undefined input', () => {
    expect(getLogoUrlFromDomainName(undefined, SERVER_BASE_URL)).toBe(
      undefined,
    );
  });

  test('should return undefined without a server base url', () => {
    expect(getLogoUrlFromDomainName('example.com')).toBe(undefined);
  });
});
