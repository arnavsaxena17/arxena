import {
  assertNonEmptyLinkedinLiAtForUnipileConnect,
  buildUnipileLinkedinCookieConnectBody,
  normalizeLinkedinConnectionCountry,
  normalizeLinkedinConnectionIp,
  parseExtensionLinkedinCookieToken,
  resolveLinkedinConnectUserAgent,
  shouldDisconnectStoredLinkedinAccountForNewLiA,
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

  it('rejects empty li_at access tokens', () => {
    expect(() =>
      buildUnipileLinkedinCookieConnectBody({
        accessToken: '   ',
      }),
    ).toThrow(
      'Cannot POST /api/v1/accounts without a non-empty LinkedIn li_at access_token',
    );
    expect(() => assertNonEmptyLinkedinLiAtForUnipileConnect('')).toThrow();
  });
});

describe('resolveLinkedinConnectUserAgent', () => {
  it('prefers stored user agent over request user agent', () => {
    expect(
      resolveLinkedinConnectUserAgent({
        storedUserAgent: 'stored-ua',
        requestUserAgent: 'request-ua',
      }),
    ).toBe('stored-ua');
  });

  it('falls back to request user agent when stored is missing', () => {
    expect(
      resolveLinkedinConnectUserAgent({
        requestUserAgent: 'request-ua',
      }),
    ).toBe('request-ua');
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

describe('parseExtensionLinkedinCookieToken', () => {
  it('returns undefined when the extension omits the field', () => {
    expect(parseExtensionLinkedinCookieToken(undefined)).toBeUndefined();
  });

  it('returns null when the extension sends an empty cookie', () => {
    expect(parseExtensionLinkedinCookieToken('')).toBeNull();
    expect(parseExtensionLinkedinCookieToken('   ')).toBeNull();
  });

  it('returns the trimmed token when present', () => {
    expect(parseExtensionLinkedinCookieToken('  li-at-token  ')).toBe(
      'li-at-token',
    );
  });
});

describe('shouldDisconnectStoredLinkedinAccountForNewLiA', () => {
  it('returns true when a valid li_a is first acquired and li_at is unchanged', () => {
    expect(
      shouldDisconnectStoredLinkedinAccountForNewLiA({
        storedLiAt: 'same-li-at',
        storedLiA: null,
        incomingLiAt: 'same-li-at',
        incomingLiA: 'new-li-a',
      }),
    ).toBe(true);
  });

  it('returns true when li_a is first acquired and li_at is omitted', () => {
    expect(
      shouldDisconnectStoredLinkedinAccountForNewLiA({
        storedLiAt: 'same-li-at',
        storedLiA: null,
        incomingLiAt: undefined,
        incomingLiA: 'new-li-a',
      }),
    ).toBe(true);
  });

  it('returns false when stored li_a already exists', () => {
    expect(
      shouldDisconnectStoredLinkedinAccountForNewLiA({
        storedLiAt: 'same-li-at',
        storedLiA: 'old-li-a',
        incomingLiAt: 'same-li-at',
        incomingLiA: 'new-li-a',
      }),
    ).toBe(false);
  });

  it('returns false when stored li_at is missing', () => {
    expect(
      shouldDisconnectStoredLinkedinAccountForNewLiA({
        storedLiAt: null,
        storedLiA: null,
        incomingLiAt: 'new-li-at',
        incomingLiA: 'new-li-a',
      }),
    ).toBe(false);
  });

  it('returns false when incoming li_a is null or omitted', () => {
    expect(
      shouldDisconnectStoredLinkedinAccountForNewLiA({
        storedLiAt: 'same-li-at',
        storedLiA: null,
        incomingLiAt: 'same-li-at',
        incomingLiA: null,
      }),
    ).toBe(false);
    expect(
      shouldDisconnectStoredLinkedinAccountForNewLiA({
        storedLiAt: 'same-li-at',
        storedLiA: null,
        incomingLiAt: 'same-li-at',
        incomingLiA: undefined,
      }),
    ).toBe(false);
  });

  it('returns false when li_at also changes', () => {
    expect(
      shouldDisconnectStoredLinkedinAccountForNewLiA({
        storedLiAt: 'old-li-at',
        storedLiA: null,
        incomingLiAt: 'new-li-at',
        incomingLiA: 'new-li-a',
      }),
    ).toBe(false);
  });
});
