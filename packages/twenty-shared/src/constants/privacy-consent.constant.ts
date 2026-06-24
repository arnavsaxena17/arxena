export const PRIVACY_CONSENT_COOKIE_NAME = 'arx_consent';

/** Must match Privacy Policy "Last updated" on arxena.com/legal/privacy */
export const PRIVACY_POLICY_VERSION = '2025-03-27';

export const PRIVACY_CONSENT_ACTIONS = [
  'accept_all',
  'reject_all',
  'custom',
  'withdraw',
] as const;

export type PrivacyConsentAction = (typeof PRIVACY_CONSENT_ACTIONS)[number];

export const PRIVACY_CONSENT_TYPES = [
  'cookie_banner',
  'terms_at_signup',
] as const;

export type PrivacyConsentType = (typeof PRIVACY_CONSENT_TYPES)[number];

export const PRIVACY_CONSENT_SOURCES = ['website', 'app'] as const;

export type PrivacyConsentSource = (typeof PRIVACY_CONSENT_SOURCES)[number];

export type PrivacyConsentCategories = {
  necessary: true;
  analytics: boolean;
  functional: boolean;
};

export type PrivacyConsentCookieValue = {
  visitorId: string;
  policyVersion: string;
  categories: PrivacyConsentCategories;
  action: PrivacyConsentAction;
  consentedAt: string;
};

export const DEFAULT_REJECT_CONSENT_CATEGORIES: PrivacyConsentCategories = {
  necessary: true,
  analytics: false,
  functional: false,
};

export const DEFAULT_ACCEPT_ALL_CONSENT_CATEGORIES: PrivacyConsentCategories = {
  necessary: true,
  analytics: true,
  functional: true,
};
