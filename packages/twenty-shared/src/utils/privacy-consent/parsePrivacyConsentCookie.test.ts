import {
    DEFAULT_ACCEPT_ALL_CONSENT_CATEGORIES,
    PRIVACY_CONSENT_COOKIE_NAME,
    type PrivacyConsentCookieValue,
} from '../../constants/privacy-consent.constant';

import {
    parsePrivacyConsentCookieValue,
    readPrivacyConsentCookieFromDocument,
} from './parsePrivacyConsentCookie';

describe('parsePrivacyConsentCookieValue', () => {
  it('parses a valid consent cookie payload', () => {
    console.log('test: parses a valid consent cookie payload');

    const value: PrivacyConsentCookieValue = {
      visitorId: '11111111-1111-4111-8111-111111111111',
      policyVersion: '2025-03-27',
      categories: DEFAULT_ACCEPT_ALL_CONSENT_CATEGORIES,
      action: 'accept_all',
      consentedAt: '2026-06-23T10:00:00.000Z',
    };

    const raw = encodeURIComponent(JSON.stringify(value));
    const parsed = parsePrivacyConsentCookieValue(raw);

    expect(parsed).toEqual(value);
  });

  it('returns null for invalid cookie payloads', () => {
    console.log('test: returns null for invalid cookie payloads');

    expect(parsePrivacyConsentCookieValue('not-json')).toBeNull();
    expect(parsePrivacyConsentCookieValue(undefined)).toBeNull();
    expect(
      parsePrivacyConsentCookieValue(
        encodeURIComponent(
          JSON.stringify({
            visitorId: '11111111-1111-4111-8111-111111111111',
            policyVersion: '2025-03-27',
            categories: {
              necessary: true,
              analytics: true,
              functional: 'yes',
            },
            action: 'accept_all',
            consentedAt: '2026-06-23T10:00:00.000Z',
          }),
        ),
      ),
    ).toBeNull();
  });

  it('reads the consent cookie from document.cookie', () => {
    console.log('test: reads the consent cookie from document.cookie');

    const value: PrivacyConsentCookieValue = {
      visitorId: '22222222-2222-4222-8222-222222222222',
      policyVersion: '2025-03-27',
      categories: DEFAULT_ACCEPT_ALL_CONSENT_CATEGORIES,
      action: 'reject_all',
      consentedAt: '2026-06-23T10:00:00.000Z',
    };

    const cookie = `${PRIVACY_CONSENT_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(value))}`;

    expect(readPrivacyConsentCookieFromDocument(cookie)).toEqual(value);
  });
});
