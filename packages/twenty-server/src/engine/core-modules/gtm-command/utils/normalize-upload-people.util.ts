import { isNonEmptyString } from '@sniptt/guards';

import { isValidLinkedInProviderId } from 'src/engine/core-modules/gtm-command/utils/extract-linkedin-attendee-id.util';
import { extractLinkedinProfileId } from 'src/engine/core-modules/gtm-command/utils/extract-linkedin-profile-id.util';

export type UploadProfilesPerson = {
  name?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  headline?: string;
  company?: string;
  companyName?: string;
  companyId?: string;
  jobCompanyId?: string;
  location?: string;
  linkedinUrl?: string;
  linkedinProfileId?: string;
  peopleId?: string;
  profilePictureUrl?: string;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const parseJsonValue = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

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

const firstExperience = (
  record: Record<string, unknown>,
): Record<string, unknown> | null => {
  const raw = record.experience ?? record.work_experience;

  if (!Array.isArray(raw) || raw.length === 0) {
    return null;
  }

  const first = raw[0];

  return first && typeof first === 'object'
    ? (first as Record<string, unknown>)
    : null;
};

const looksLikeLinkedinUrl = (value: string): boolean =>
  /linkedin\.com\/(?:mwlite\/)?in\//i.test(value) ||
  /linkedin\.com\/sales\/(?:lead|people)\//i.test(value);

export const toUploadProfilesPerson = (
  row: unknown,
): UploadProfilesPerson | null => {
  if (typeof row === 'string') {
    const trimmed = row.trim();

    if (!trimmed || UUID_REGEX.test(trimmed)) {
      return null;
    }

    const parsed = parseJsonValue(trimmed);

    if (parsed !== trimmed) {
      return toUploadProfilesPerson(parsed);
    }

    if (looksLikeLinkedinUrl(trimmed)) {
      return {
        linkedinUrl: trimmed,
        linkedinProfileId: extractLinkedinProfileId(trimmed),
      };
    }

    if (isValidLinkedInProviderId(trimmed)) {
      return { linkedinProfileId: trimmed, peopleId: trimmed };
    }

    return null;
  }

  if (typeof row !== 'object' || row === null || Array.isArray(row)) {
    return null;
  }

  const person = row as Record<string, unknown>;
  const experience = firstExperience(person);
  const firstName = readString(person, ['firstName', 'first_name']);
  const lastName = readString(person, ['lastName', 'last_name']);
  const name =
    readString(person, ['name', 'fullName']) ||
    [firstName, lastName].filter(Boolean).join(' ');
  const headline = readString(person, ['headline', 'title', 'jobTitle']);
  const title =
    readString(person, ['title', 'jobTitle']) ||
    (experience ? readString(experience, ['position', 'title', 'jobTitle']) : '') ||
    headline;
  const company =
    readString(person, ['company', 'companyName', 'jobCompanyName']) ||
    (experience
      ? readString(experience, ['company', 'companyName', 'company_name'])
      : '');
  const linkedinUrl = readString(person, [
    'linkedinUrl',
    'profileUrl',
    'profile_url',
  ]);
  const linkedinProfileId =
    readString(person, ['linkedinProfileId', 'public_identifier']) ||
    extractLinkedinProfileId(linkedinUrl);
  const profilePictureUrl = readString(person, [
    'profilePictureUrl',
    'displayPicture',
    'profile_picture_url',
    'avatarUrl',
  ]);
  const location = readString(person, ['location', 'locationName']);
  const peopleId = readString(person, ['peopleId']) || linkedinProfileId;
  const companyId = readString(person, ['companyId', 'jobCompanyId']);

  if (
    !isNonEmptyString(linkedinUrl) &&
    !isNonEmptyString(linkedinProfileId) &&
    !isNonEmptyString(firstName) &&
    !isNonEmptyString(name)
  ) {
    return null;
  }

  return {
    ...(isNonEmptyString(name) ? { name } : {}),
    ...(isNonEmptyString(firstName) ? { firstName } : {}),
    ...(isNonEmptyString(lastName) ? { lastName } : {}),
    ...(isNonEmptyString(title) ? { title } : {}),
    ...(isNonEmptyString(headline) ? { headline } : {}),
    ...(isNonEmptyString(company) ? { company, companyName: company } : {}),
    ...(isNonEmptyString(companyId) ? { companyId } : {}),
    ...(isNonEmptyString(location) ? { location } : {}),
    ...(isNonEmptyString(linkedinUrl) ? { linkedinUrl } : {}),
    ...(isNonEmptyString(linkedinProfileId) ? { linkedinProfileId } : {}),
    ...(isNonEmptyString(peopleId) ? { peopleId } : {}),
    ...(isNonEmptyString(profilePictureUrl) ? { profilePictureUrl } : {}),
  };
};

const unwrapPeopleRows = (raw: unknown): unknown[] => {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();

    if (!trimmed) {
      return [];
    }

    const parsed = parseJsonValue(trimmed);

    if (parsed !== trimmed) {
      return unwrapPeopleRows(parsed);
    }

    return [trimmed];
  }

  if (Array.isArray(raw)) {
    if (raw.length === 1 && typeof raw[0] === 'string') {
      const parsed = parseJsonValue(raw[0].trim());

      if (parsed !== raw[0]) {
        return unwrapPeopleRows(parsed);
      }
    }

    return raw.flatMap((item) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const record = item as Record<string, unknown>;

        if (Array.isArray(record.people)) {
          return record.people;
        }
      }

      return [item];
    });
  }

  if (typeof raw !== 'object' || raw === null) {
    return [];
  }

  const record = raw as Record<string, unknown>;

  if (Array.isArray(record.people)) {
    return record.people;
  }

  if (Array.isArray(record.candidates)) {
    return record.candidates;
  }

  return [raw];
};

export const normalizeUploadPeople = (raw: unknown): UploadProfilesPerson[] =>
  unwrapPeopleRows(raw)
    .map((item) => toUploadProfilesPerson(item))
    .filter((person): person is UploadProfilesPerson => person !== null);
