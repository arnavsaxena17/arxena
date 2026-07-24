import { resolveLinkedinSyncClientIp } from '../resolve-linkedin-sync-client-ip.util';

describe('resolveLinkedinSyncClientIp', () => {
  it('prefers a public server IPv4 over extension IP', () => {
    expect(
      resolveLinkedinSyncClientIp({
        serverIp: '203.0.113.10',
        extensionIp: '198.51.100.20',
      }),
    ).toBe('203.0.113.10');
  });

  it('falls back to extension public IPv4 when server IP is localhost', () => {
    expect(
      resolveLinkedinSyncClientIp({
        serverIp: '127.0.0.1',
        extensionIp: '203.0.113.10',
      }),
    ).toBe('203.0.113.10');
  });

  it('falls back to extension public IPv4 when server IP is IPv6 localhost', () => {
    expect(
      resolveLinkedinSyncClientIp({
        serverIp: '::1',
        extensionIp: '203.0.113.10',
      }),
    ).toBe('203.0.113.10');
  });

  it('returns undefined when only private or invalid IPs are available', () => {
    expect(
      resolveLinkedinSyncClientIp({
        serverIp: '127.0.0.1',
        extensionIp: '::1',
      }),
    ).toBeUndefined();
  });
});
