import { isValidLinkedInProviderId } from 'src/engine/core-modules/gtm-command/utils/extract-linkedin-attendee-id.util';

const readProfileString = (
  profile: Record<string, unknown>,
  keys: string[],
): string => {
  for (const key of keys) {
    const value = profile[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
};

const mapExperience = (
  profile: Record<string, unknown>,
): Array<{
  company: string;
  position: string;
  location: string;
  description: string;
  start: string;
  end: string;
}> => {
  const raw = profile.work_experience ?? profile.experience;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => {
      const nestedCompany =
        item.company && typeof item.company === 'object'
          ? (item.company as Record<string, unknown>)
          : undefined;

      return {
        company:
          readProfileString(item, ['company', 'companyName', 'company_name']) ||
          (nestedCompany
            ? readProfileString(nestedCompany, ['name', 'title'])
            : ''),
        position: readProfileString(item, ['position', 'title', 'jobTitle']),
        location: readProfileString(item, ['location']),
        description: readProfileString(item, ['description', 'summary']),
        start: readProfileString(item, ['start', 'startDate', 'start_date']),
        end: readProfileString(item, ['end', 'endDate', 'end_date']),
      };
    });
};

const mapSkills = (profile: Record<string, unknown>): string[] => {
  const raw = profile.skills;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
      if (typeof item === 'string') {
        return item.trim();
      }
      if (item && typeof item === 'object' && 'name' in item) {
        const name = (item as { name?: unknown }).name;
        return typeof name === 'string' ? name.trim() : '';
      }
      return '';
    })
    .filter((name) => name.length > 0);
};

const buildLinkedinProfileUrl = (
  profile: Record<string, unknown>,
  publicIdentifier: string,
  fallbackIdentifier: string,
): string => {
  const fromProfile = readProfileString(profile, [
    'profile_url',
    'linkedinUrl',
    'url',
  ]);

  if (fromProfile) {
    return fromProfile;
  }

  const slug = !isValidLinkedInProviderId(publicIdentifier)
    ? publicIdentifier
    : !isValidLinkedInProviderId(fallbackIdentifier)
      ? fallbackIdentifier
      : '';

  return slug ? `https://www.linkedin.com/in/${slug}` : '';
};

export const mapUnipileLinkedinProfile = (
  profile: Record<string, unknown>,
  fallbackIdentifier: string,
) => {
  const publicIdentifier = readProfileString(profile, ['public_identifier']);
  const providerId = readProfileString(profile, ['provider_id']);
  const linkedinProfileId = isValidLinkedInProviderId(providerId)
    ? providerId
    : isValidLinkedInProviderId(fallbackIdentifier)
      ? fallbackIdentifier
      : publicIdentifier || fallbackIdentifier;
  const firstName = readProfileString(profile, ['first_name', 'firstName']);
  const lastName = readProfileString(profile, ['last_name', 'lastName']);

  return {
    success: true as const,
    linkedinProfileId,
    firstName,
    lastName,
    headline: readProfileString(profile, ['headline']),
    about: readProfileString(profile, ['about', 'summary']),
    location: readProfileString(profile, ['location']),
    linkedinUrl: buildLinkedinProfileUrl(
      profile,
      publicIdentifier,
      fallbackIdentifier,
    ),
    profilePictureUrl: readProfileString(profile, [
      'profile_picture_url',
      'profilePictureUrl',
      'picture_url',
    ]),
    experience: mapExperience(profile),
    skills: mapSkills(profile),
    snapshot: JSON.stringify(profile),
    error: '',
  };
};
