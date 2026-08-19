const LINKEDIN_PROVIDER_ID_REGEX = /^ACoAA[A-Za-z0-9_-]{20,40}$/;

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
