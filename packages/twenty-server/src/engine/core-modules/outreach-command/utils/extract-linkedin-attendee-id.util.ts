// Classic LinkedIn member ids start with ACoAA; Sales Navigator with ACwAA.
const LINKEDIN_CLASSIC_PROVIDER_ID_REGEX = /^ACoAA[A-Za-z0-9_-]{20,40}$/;
const LINKEDIN_SALES_NAVIGATOR_PROVIDER_ID_REGEX =
  /^ACwAA[A-Za-z0-9_-]{20,40}$/;
const LINKEDIN_PROVIDER_ID_REGEX = /^AC[ow]AA[A-Za-z0-9_-]{20,40}$/;

export type LinkedinMessagingApi = 'classic' | 'sales_navigator' | 'recruiter';

export const isClassicLinkedInProviderId = (
  value: string | null | undefined,
): boolean => {
  if (!value) {
    return false;
  }

  return LINKEDIN_CLASSIC_PROVIDER_ID_REGEX.test(value.trim());
};

export const isSalesNavigatorLinkedInProviderId = (
  value: string | null | undefined,
): boolean => {
  if (!value) {
    return false;
  }

  return LINKEDIN_SALES_NAVIGATOR_PROVIDER_ID_REGEX.test(value.trim());
};

export const isValidLinkedInProviderId = (
  value: string | null | undefined,
): boolean => {
  if (!value) {
    return false;
  }

  return LINKEDIN_PROVIDER_ID_REGEX.test(value.trim());
};

export const pickLinkedinAttendeeIdFromUnipileProfile = (
  profile: Record<string, unknown> | null | undefined,
): string => {
  if (!profile) {
    return '';
  }

  const providerId =
    typeof profile.provider_id === 'string' ? profile.provider_id.trim() : '';

  if (providerId) {
    return providerId;
  }

  const publicIdentifier =
    typeof profile.public_identifier === 'string'
      ? profile.public_identifier.trim()
      : '';

  return publicIdentifier;
};
