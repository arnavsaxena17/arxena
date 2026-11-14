import {
  extractRequestOrigin,
  isOriginAllowed,
  normalizeAllowedOrigins,
} from '../org-chart-embed-origin.util';

describe('org-chart-embed-origin.util', () => {
  it('normalizeAllowedOrigins normalizes host origins', () => {
    expect(normalizeAllowedOrigins(['https://client.com', 'http://www.foo.io/'])).toEqual(
      ['https://client.com', 'http://www.foo.io'],
    );
  });

  it('isOriginAllowed matches exact origin', () => {
    expect(
      isOriginAllowed('https://client.com', ['https://client.com']),
    ).toBe(true);
    expect(
      isOriginAllowed('https://evil.com', ['https://client.com']),
    ).toBe(false);
  });

  it('isOriginAllowed supports wildcard subdomains', () => {
    expect(
      isOriginAllowed('https://app.client.com', ['https://*.client.com']),
    ).toBe(true);
    expect(
      isOriginAllowed('https://client.com', ['https://*.client.com']),
    ).toBe(true);
  });

  it('extractRequestOrigin falls back to referer', () => {
    expect(
      extractRequestOrigin({
        origin: null,
        referer: 'https://client.com/careers',
      }),
    ).toBe('https://client.com');
  });
});
