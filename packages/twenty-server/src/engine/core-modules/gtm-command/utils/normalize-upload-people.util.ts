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
  candidateId?: string;
  projectId?: string;
  current_positions?: unknown[];
  stdFunction?: string;
  stdFunctionRoot?: string;
  stdGrade?: string;
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

const readLinkUrl = (value: unknown): string => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return '';
  }

  const record = value as Record<string, unknown>;
  const primary = record.primaryLinkUrl;

  return typeof primary === 'string' && primary.trim() ? primary.trim() : '';
};

const readStringOrLink = (
  record: Record<string, unknown>,
  keys: string[],
): string => {
  for (const key of keys) {
    const fromString = readString(record, [key]);

    if (fromString) {
      return fromString;
    }

    const fromLink = readLinkUrl(record[key]);

    if (fromLink) {
      return fromLink;
    }
  }

  return '';
};

const readNestedName = (
  record: Record<string, unknown>,
): { firstName: string; lastName: string; name: string } => {
  const nested = record.name;

  if (typeof nested !== 'object' || nested === null || Array.isArray(nested)) {
    return { firstName: '', lastName: '', name: '' };
  }

  const nameRecord = nested as Record<string, unknown>;
  const firstName = readString(nameRecord, ['firstName', 'first_name']);
  const lastName = readString(nameRecord, ['lastName', 'last_name']);

  return {
    firstName,
    lastName,
    name: [firstName, lastName].filter(Boolean).join(' '),
  };
};

const looksLikeCandidateRecord = (record: Record<string, unknown>): boolean =>
  record.linkedinUrl != null ||
  record.linkedinLink != null ||
  record.projectsId != null ||
  record.peopleId != null ||
  record.jobTitle != null;

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
  const nestedName = readNestedName(person);
  const firstName =
    readString(person, ['firstName', 'first_name']) || nestedName.firstName;
  const lastName =
    readString(person, ['lastName', 'last_name']) || nestedName.lastName;
  const name =
    readString(person, ['fullName']) ||
    (typeof person.name === 'string' ? person.name.trim() : '') ||
    nestedName.name ||
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
  const linkedinUrl =
    readStringOrLink(person, [
      'linkedinUrl',
      'linkedinLink',
      'profileUrl',
      'profile_url',
    ]) || readLinkUrl(person);
  const linkedinProfileId =
    readString(person, ['linkedinProfileId', 'public_identifier']) ||
    extractLinkedinProfileId(linkedinUrl) ||
    extractLinkedinProfileId(person);
  const profilePictureUrl = readString(person, [
    'profilePictureUrl',
    'displayPicture',
    'profile_picture_url',
    'avatarUrl',
  ]);
  const location = readString(person, ['location', 'locationName']);
  const peopleId =
    readString(person, ['peopleId', 'personId']) || linkedinProfileId;
  const companyId = readString(person, ['companyId', 'jobCompanyId']);
  const candidateIdRaw = readString(person, ['candidateId']);
  const recordId = readString(person, ['id']);
  const candidateId = UUID_REGEX.test(candidateIdRaw)
    ? candidateIdRaw
    : UUID_REGEX.test(recordId) && looksLikeCandidateRecord(person)
      ? recordId
      : '';
  const projectId = readString(person, ['projectId', 'projectsId']);
  const currentPositions = Array.isArray(person.current_positions)
    ? person.current_positions
    : Array.isArray(person.currentPositions)
      ? person.currentPositions
      : [];
  const stdFunction = readString(person, ['stdFunction']);
  const stdFunctionRoot = readString(person, ['stdFunctionRoot']);
  const stdGrade = readString(person, ['stdGrade']);

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
    ...(isNonEmptyString(candidateId) ? { candidateId } : {}),
    ...(isNonEmptyString(projectId) ? { projectId } : {}),
    ...(currentPositions.length > 0 ? { current_positions: currentPositions } : {}),
    ...(isNonEmptyString(stdFunction) ? { stdFunction } : {}),
    ...(isNonEmptyString(stdFunctionRoot) ? { stdFunctionRoot } : {}),
    ...(isNonEmptyString(stdGrade) ? { stdGrade } : {}),
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

const visitCandidateIds = (value: unknown, ids: Set<string>): void => {
  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed) {
      return;
    }

    const parsed = parseJsonValue(trimmed);

    if (parsed !== trimmed) {
      visitCandidateIds(parsed, ids);

      return;
    }

    if (UUID_REGEX.test(trimmed)) {
      ids.add(trimmed);
    }

    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      visitCandidateIds(item, ids);
    }

    return;
  }

  if (typeof value !== 'object' || value === null) {
    return;
  }

  const record = value as Record<string, unknown>;
  const candidateId = readString(record, ['candidateId']);
  const recordId = readString(record, ['id']);

  if (UUID_REGEX.test(candidateId)) {
    ids.add(candidateId);
  }

  if (UUID_REGEX.test(recordId) && looksLikeCandidateRecord(record)) {
    ids.add(recordId);
  }

  if (Array.isArray(record.people)) {
    visitCandidateIds(record.people, ids);
  }

  if (Array.isArray(record.candidates)) {
    visitCandidateIds(record.candidates, ids);
  }
};

export const collectUploadCandidateIds = (...values: unknown[]): string[] => {
  const ids = new Set<string>();

  for (const value of values) {
    visitCandidateIds(value, ids);
  }

  return [...ids];
};
