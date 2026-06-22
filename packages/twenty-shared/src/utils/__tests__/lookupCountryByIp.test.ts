import { lookupCountryByIp } from '../clientGeo/lookupCountryByIp';

describe('lookupCountryByIp', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.IPINFO_TOKEN;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns null for private IPs without calling ipinfo', async () => {
    global.fetch = jest.fn();
    await expect(lookupCountryByIp('127.0.0.1')).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
    console.log('[lookupCountryByIp.test] private IP skipped');
  });

  it('returns country code from ipinfo response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ country: 'in' }),
    });

    await expect(lookupCountryByIp('203.0.113.10')).resolves.toBe('IN');
    console.log('[lookupCountryByIp.test] country parsed');
  });
});
