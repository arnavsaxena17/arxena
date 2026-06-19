import { resolveLinkedinCountryFromIp } from '../resolve-linkedin-country-from-ip.util';

describe('resolveLinkedinCountryFromIp', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns country code from ipinfo for a public IPv4 address', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ country: 'US' }),
    }) as unknown as typeof fetch;

    await expect(resolveLinkedinCountryFromIp('203.0.113.10')).resolves.toBe('US');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('203.0.113.10'),
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });

  it('returns null for private IPv4 addresses', async () => {
    global.fetch = jest.fn();
    await expect(resolveLinkedinCountryFromIp('127.0.0.1')).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
