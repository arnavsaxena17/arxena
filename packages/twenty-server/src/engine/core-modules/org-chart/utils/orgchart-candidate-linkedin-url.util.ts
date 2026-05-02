/**
 * Resolves a LinkedIn profile URL from heterogeneous candidate rows (Apify, Unipile,
 * Apollo, merged dedupe payloads). Used before sending {@link StandardizedOrgChartPerson}
 * to the Python org-chart builder so `linkedin_url` is never dropped due to naming alone.
 */
export const extractLinkedinProfileUrlFromOrgChartCandidateRow = (
  raw: Record<string, unknown>,
): string => {
  const keys = [
    'linkedinUrl',
    'profileUrl',
    'linkedin_url',
    'std_linkedin_url',
    'public_profile_url',
    'profile_url',
    'linkedInUrl',
    'linkedinurl',
    'publicProfileUrl',
  ] as const;
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === 'string') {
      const t = v.trim();
      if (t) {
        return t;
      }
    }
  }
  return '';
};

/**
 * Profile headshot URL across sources (table transformer uses camelCase; Apify raw uses `photo`).
 */
export const extractProfilePictureUrlFromOrgChartCandidateRow = (
  raw: Record<string, unknown>,
): string => {
  const keys = [
    'profile_picture_url',
    'profile_picture_url_large',
    'profilePictureUrl',
    'displayPicture',
    'photo',
    'picture_url',
    'picture',
    'image',
  ] as const;
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === 'string') {
      const t = v.trim();
      if (
        t &&
        !/^null$/iu.test(t) &&
        !/^undefined$/iu.test(t) &&
        t !== '0'
      ) {
        return t;
      }
    }
  }
  return '';
};
