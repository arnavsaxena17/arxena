import { isNonEmptyString } from '@sniptt/guards';

const PLACEHOLDER_NAMES = new Set(['john doe', 'jane doe', 'unknown']);

const readString = (
  record: Record<string, unknown>,
  keys: string[],
): string => {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
};

export type FetchedLinkedinProfile = {
  success?: boolean;
  firstName?: string;
  lastName?: string;
  headline?: string;
  about?: string;
  location?: string;
  linkedinUrl?: string;
  profilePictureUrl?: string;
  linkedinProfileId?: string;
  experience?: Array<{
    company?: string;
    position?: string;
    location?: string;
    description?: string;
    start?: string;
    end?: string;
  }>;
  skills?: string[];
  error?: string;
};

const LINKEDIN_IN_URL = /linkedin\.com\/(?:mwlite\/)?in\//i;

const collectCandidateUrlCandidates = (
  candidate: Record<string, unknown>,
): string[] => {
  const keys = [
    'linkedin_url',
    'linkedinUrl',
    'linkedinLink',
    'public_linkedin_url',
    'publicLinkedinUrl',
    'public_profile_url',
    'publicProfileUrl',
    'profile_url',
    'profileUrl',
  ];
  const urls: string[] = [];

  for (const key of keys) {
    const value = candidate[key];

    if (typeof value === 'string' && value.trim()) {
      urls.push(value.trim());
    }

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const primary = (value as Record<string, unknown>).primaryLinkUrl;

      if (typeof primary === 'string' && primary.trim()) {
        urls.push(primary.trim());
      }
    }
  }

  return urls;
};

export const readLinkedinUrlFromCandidate = (candidate: unknown): string => {
  if (typeof candidate === 'string') {
    return LINKEDIN_IN_URL.test(candidate.trim()) ? candidate.trim() : '';
  }

  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return '';
  }

  const urls = collectCandidateUrlCandidates(
    candidate as Record<string, unknown>,
  );
  const publicUrl = urls.find((url) => LINKEDIN_IN_URL.test(url));

  return publicUrl ?? urls[0] ?? '';
};

export const linkedinPremiumProfileDisplayName = (
  candidate: unknown,
): string => {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return '';
  }

  const record = candidate as Record<string, unknown>;
  const firstName = readString(record, ['firstName', 'first_name']);
  const lastName = readString(record, ['lastName', 'last_name']);

  return (
    readString(record, ['fullName', 'full_name', 'name']) ||
    [firstName, lastName].filter(Boolean).join(' ')
  );
};

export const linkedinPremiumProfileNeedsFetch = (
  candidate: unknown,
): boolean => {
  const url = readLinkedinUrlFromCandidate(candidate);
  if (!isNonEmptyString(url)) {
    return false;
  }

  const name = linkedinPremiumProfileDisplayName(candidate).toLowerCase();

  return !name || PLACEHOLDER_NAMES.has(name);
};

export const mapFetchedLinkedinProfileToPremiumUpload = (
  fetched: FetchedLinkedinProfile,
  fallbackUrl = '',
): Record<string, unknown> | null => {
  const firstName = fetched.firstName?.trim() ?? '';
  const lastName = fetched.lastName?.trim() ?? '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  const linkedinUrl =
    fetched.linkedinUrl?.trim() || fallbackUrl.trim() || '';

  if (!fullName && !linkedinUrl) {
    return null;
  }

  const experience = (fetched.experience ?? []).map((item) => ({
    company: item.company ?? '',
    company_name: item.company ?? '',
    position: item.position ?? '',
    job_title: item.position ?? '',
    title: item.position ?? '',
    location: item.location ?? '',
    description: item.description ?? '',
    start: item.start ?? '',
    end: item.end ?? '',
    time_period: [item.start, item.end].filter(Boolean).join(' - '),
  }));
  const current = experience[0];

  return {
    fullName,
    full_name: fullName,
    name: fullName,
    firstName,
    lastName,
    headline: fetched.headline ?? '',
    title: current?.job_title || fetched.headline || '',
    job_title: current?.job_title || fetched.headline || '',
    summary: fetched.about ?? '',
    about: fetched.about ?? '',
    location: fetched.location ?? '',
    location_name: fetched.location ?? '',
    linkedin_url: linkedinUrl,
    linkedinUrl,
    profile_url: linkedinUrl,
    profileUrl: linkedinUrl,
    public_profile_url: linkedinUrl,
    public_identifier: fetched.linkedinProfileId ?? '',
    linkedinProfileId: fetched.linkedinProfileId ?? '',
    display_picture: fetched.profilePictureUrl ?? '',
    profile_picture_url: fetched.profilePictureUrl ?? '',
    profilePictureUrl: fetched.profilePictureUrl ?? '',
    company_name: current?.company_name ?? '',
    experience,
    experiences: experience,
    skills: fetched.skills ?? [],
    fetched_from_url: true,
  };
};

export const hydrateLinkedinPremiumCandidates = async (
  candidates: unknown[],
  fetchProfile: (linkedinUrl: string) => Promise<FetchedLinkedinProfile>,
): Promise<unknown[]> => {
  const hydrated: unknown[] = [];

  for (const candidate of candidates) {
    const linkedinUrl = readLinkedinUrlFromCandidate(candidate);

    if (!isNonEmptyString(linkedinUrl)) {
      hydrated.push(candidate);
      continue;
    }

    try {
      const fetched = await fetchProfile(linkedinUrl);
      const mapped = fetched.success
        ? mapFetchedLinkedinProfileToPremiumUpload(fetched, linkedinUrl)
        : null;

      if (!mapped) {
        hydrated.push(candidate);
        continue;
      }

      const original =
        candidate && typeof candidate === 'object' && !Array.isArray(candidate)
          ? (candidate as Record<string, unknown>)
          : {};

      hydrated.push({
        ...original,
        ...mapped,
        phone_number: original.phone_number ?? original.phoneNumber,
        email_address: original.email_address ?? original.emailAddress,
      });
    } catch {
      hydrated.push(candidate);
    }
  }

  return hydrated;
};
