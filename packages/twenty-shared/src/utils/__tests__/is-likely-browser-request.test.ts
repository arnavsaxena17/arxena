import { isLikelyBrowserRequest } from '../is-likely-browser-request';

describe('isLikelyBrowserRequest', () => {
  it('returns true when Sec-Fetch-Site is present', () => {
    expect(
      isLikelyBrowserRequest({
        get: (name) =>
          name === 'sec-fetch-site' ? 'same-origin' : null,
      }),
    ).toBe(true);
  });

  it('returns true when Sec-CH-UA is present', () => {
    expect(
      isLikelyBrowserRequest({
        get: (name) =>
          name === 'sec-ch-ua'
            ? '"Chromium";v="120", "Google Chrome";v="120"'
            : null,
      }),
    ).toBe(true);
  });

  it('returns false for Chrome User-Agent without fetch metadata', () => {
    expect(
      isLikelyBrowserRequest({
        get: (name) =>
          name === 'user-agent'
            ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
            : null,
      }),
    ).toBe(false);
  });
});
