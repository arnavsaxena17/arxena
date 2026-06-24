import {
    DEFAULT_ACCEPT_ALL_CONSENT_CATEGORIES,
    DEFAULT_REJECT_CONSENT_CATEGORIES,
    PRIVACY_CONSENT_COOKIE_NAME,
    PRIVACY_POLICY_VERSION,
    type PrivacyConsentAction,
    type PrivacyConsentCategories,
    type PrivacyConsentCookieValue,
} from 'twenty-shared';

const CONSENT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const getConsentCookieDomain = (): string | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const hostname = window.location.hostname;

  if (hostname === 'arxena.com' || hostname.endsWith('.arxena.com')) {
    return '.arxena.com';
  }

  return undefined;
};

export const createVisitorId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;

    return value.toString(16);
  });
};

export const buildConsentCookieValue = (
  input: {
    visitorId: string;
    action: PrivacyConsentAction;
    categories: PrivacyConsentCategories;
    policyVersion?: string;
  },
): PrivacyConsentCookieValue => ({
  visitorId: input.visitorId,
  policyVersion: input.policyVersion ?? PRIVACY_POLICY_VERSION,
  categories: input.categories,
  action: input.action,
  consentedAt: new Date().toISOString(),
});

export const writePrivacyConsentCookie = (
  value: PrivacyConsentCookieValue,
): void => {
  if (typeof document === 'undefined') {
    return;
  }

  const encoded = encodeURIComponent(JSON.stringify(value));
  const domain = getConsentCookieDomain();
  const domainAttribute = domain ? `; domain=${domain}` : '';

  document.cookie = `${PRIVACY_CONSENT_COOKIE_NAME}=${encoded}; path=/; max-age=${CONSENT_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${domainAttribute}`;
};

export const getConsentCategoriesForAction = (
  action: PrivacyConsentAction,
  customCategories?: PrivacyConsentCategories,
): PrivacyConsentCategories => {
  if (action === 'accept_all') {
    return DEFAULT_ACCEPT_ALL_CONSENT_CATEGORIES;
  }

  if (action === 'reject_all' || action === 'withdraw') {
    return DEFAULT_REJECT_CONSENT_CATEGORIES;
  }

  return (
    customCategories ?? {
      necessary: true,
      analytics: false,
      functional: false,
    }
  );
};
