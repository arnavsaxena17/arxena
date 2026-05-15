import { isLikelyBrowserLogoRequest } from '../is-likely-browser-logo-request';
import { isLikelyBrowserRequest } from '../is-likely-browser-request';

describe('isLikelyBrowserLogoRequest', () => {
  it('returns true when Sec-Fetch-Dest is image', () => {
    expect(
      isLikelyBrowserLogoRequest({
        get: (name) =>
          name === 'sec-fetch-dest' ? 'image' : null,
      }),
    ).toBe(true);
  });

  it('returns true for same-origin no-cors subresource loads', () => {
    expect(
      isLikelyBrowserLogoRequest({
        get: (name) => {
          if (name === 'sec-fetch-site') return 'same-origin';
          if (name === 'sec-fetch-mode') return 'no-cors';
          return null;
        },
      }),
    ).toBe(true);
  });

  it('returns false when only Sec-CH-UA is present', () => {
    const headers = {
      get: (name: string) =>
        name === 'sec-ch-ua'
          ? '"Chromium";v="120", "Google Chrome";v="120"'
          : null,
    };
    expect(isLikelyBrowserRequest(headers)).toBe(true);
    expect(isLikelyBrowserLogoRequest(headers)).toBe(false);
  });

  it('returns false for Chrome User-Agent without fetch metadata', () => {
    expect(
      isLikelyBrowserLogoRequest({
        get: (name) =>
          name === 'user-agent'
            ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
            : null,
      }),
    ).toBe(false);
  });
});
