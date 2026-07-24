import {
    PRIVACY_CONSENT_ACTIONS,
    PRIVACY_CONSENT_COOKIE_NAME,
    type PrivacyConsentAction,
    type PrivacyConsentCategories,
    type PrivacyConsentCookieValue,
} from '../../constants/privacy-consent.constant';

const isConsentAction = (value: string): value is PrivacyConsentAction =>
  (PRIVACY_CONSENT_ACTIONS as readonly string[]).includes(value);

const parseCategories = (
  value: unknown,
): PrivacyConsentCategories | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    record.necessary !== true ||
    typeof record.analytics !== 'boolean' ||
    typeof record.functional !== 'boolean'
  ) {
    return null;
  }

  return {
    necessary: true,
    analytics: record.analytics,
    functional: record.functional,
  };
};

export const parsePrivacyConsentCookieValue = (
  raw: string | null | undefined,
): PrivacyConsentCookieValue | null => {
  if (!raw) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(raw);
    const parsed = JSON.parse(decoded) as Record<string, unknown>;

    const visitorId =
      typeof parsed.visitorId === 'string' ? parsed.visitorId.trim() : '';
    const policyVersion =
      typeof parsed.policyVersion === 'string'
        ? parsed.policyVersion.trim()
        : '';
    const action =
      typeof parsed.action === 'string' && isConsentAction(parsed.action)
        ? parsed.action
        : null;
    const consentedAt =
      typeof parsed.consentedAt === 'string' ? parsed.consentedAt : '';
    const categories = parseCategories(parsed.categories);

    if (!visitorId || !policyVersion || !action || !categories || !consentedAt) {
      return null;
    }

    return {
      visitorId,
      policyVersion,
      categories,
      action,
      consentedAt,
    };
  } catch {
    return null;
  }
};

export const readPrivacyConsentCookieFromDocument = (
  cookieString?: string,
): PrivacyConsentCookieValue | null => {
  const cookies =
    cookieString ??
    (typeof document !== 'undefined' ? document.cookie : undefined);

  if (!cookies) {
    return null;
  }

  const prefix = `${PRIVACY_CONSENT_COOKIE_NAME}=`;
  const match = cookies
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  if (!match) {
    return null;
  }

  return parsePrivacyConsentCookieValue(match.slice(prefix.length));
};
