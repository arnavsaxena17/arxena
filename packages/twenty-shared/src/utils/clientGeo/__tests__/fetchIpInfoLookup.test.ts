import { ORG_CHART_VERIFIED_BOT_HEADER } from '@/constants/org-chart-guard.constant';
import {
  clearIpInfoLookupCache,
  fetchIpInfoLookup,
} from '@/utils/clientGeo/fetchIpInfoLookup';
import {
  isDeclaredBotUserAgent,
  shouldSkipIpInfoLookup,
} from '@/utils/clientGeo/shouldSkipIpInfoLookup';

describe('fetchIpInfoLookup cache', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    clearIpInfoLookupCache();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        country: 'IN',
        org: 'AS15169 Google LLC',
        hostname: 'google.com',
      }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    clearIpInfoLookupCache();
  });

  it('fetches once per IP and serves later lookups from cache', async () => {
    const first = await fetchIpInfoLookup('203.0.113.10');
    const second = await fetchIpInfoLookup('203.0.113.10');

    expect(first).toEqual({
      country: 'IN',
      org: 'AS15169 Google LLC',
      hostname: 'google.com',
    });
    expect(second).toEqual(first);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent lookups for the same IP', async () => {
    const [first, second] = await Promise.all([
      fetchIpInfoLookup('203.0.113.20'),
      fetchIpInfoLookup('203.0.113.20'),
    ]);

    expect(first.country).toBe('IN');
    expect(second.country).toBe('IN');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('stops calling ipinfo after a 429 until the cooldown clears', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 429,
    });

    const first = await fetchIpInfoLookup('203.0.113.30');
    const second = await fetchIpInfoLookup('203.0.113.31');

    expect(first).toEqual({
      country: null,
      org: null,
      hostname: null,
    });
    expect(second).toEqual(first);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('shouldSkipIpInfoLookup', () => {
  it('skips when verified bot header is set', () => {
    expect(
      shouldSkipIpInfoLookup((name) =>
        name === ORG_CHART_VERIFIED_BOT_HEADER ? '1' : null,
      ),
    ).toBe(true);
  });

  it('skips declared bot user agents', () => {
    expect(
      isDeclaredBotUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1)'),
    ).toBe(true);
    expect(
      shouldSkipIpInfoLookup((name) =>
        name === 'user-agent' ? 'Mozilla/5.0 (compatible; bingbot/2.0)' : null,
      ),
    ).toBe(true);
    expect(
      isDeclaredBotUserAgent(
        'Mozilla/5.0 (compatible; meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler))',
      ),
    ).toBe(true);
  });

  it('does not skip normal browsers', () => {
    expect(
      shouldSkipIpInfoLookup((name) =>
        name === 'user-agent'
          ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120.0.0.0'
          : null,
      ),
    ).toBe(false);
  });
});
