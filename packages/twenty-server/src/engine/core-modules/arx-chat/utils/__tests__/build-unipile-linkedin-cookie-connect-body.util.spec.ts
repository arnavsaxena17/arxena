import {
  buildUnipileLinkedinCookieConnectBody,
  normalizeLinkedinConnectionCountry,
  normalizeLinkedinConnectionIp,
} from '../build-unipile-linkedin-cookie-connect-body.util';

describe('buildUnipileLinkedinCookieConnectBody', () => {
  it('includes cookie auth fields supported by Unipile', () => {
    const body = buildUnipileLinkedinCookieConnectBody({
      accessToken: 'li-at',
      premiumToken: 'li-a',
      userAgent: 'Mozilla/5.0',
      ip: '203.0.113.10',
      country: 'in',
      reconnectAccountId: 'acc-1',
    });

    expect(body).toEqual({
      provider: 'LINKEDIN',
      access_token: 'li-at',
      premium_token: 'li-a',
      user_agent: 'Mozilla/5.0',
      ip: '203.0.113.10',
      country: 'IN',
      reconnect_account: 'acc-1',
    });
  });

  it('omits optional fields when absent or invalid', () => {
    const body = buildUnipileLinkedinCookieConnectBody({
      accessToken: 'li-at',
      country: 'invalid',
      ip: '::1',
    });

    expect(body).toEqual({
      provider: 'LINKEDIN',
      access_token: 'li-at',
    });
  });
});

describe('normalizeLinkedinConnectionCountry', () => {
  it('accepts ISO 3166-1 alpha-2 codes', () => {
    expect(normalizeLinkedinConnectionCountry('us')).toBe('US');
  });

  it('rejects invalid country codes', () => {
    expect(normalizeLinkedinConnectionCountry('USA')).toBeUndefined();
  });
});

describe('normalizeLinkedinConnectionIp', () => {
  it('accepts IPv4 addresses', () => {
    expect(normalizeLinkedinConnectionIp(' 203.0.113.10 ')).toBe('203.0.113.10');
  });

  it('rejects IPv6 addresses', () => {
    expect(normalizeLinkedinConnectionIp('::1')).toBeUndefined();
  });
});
