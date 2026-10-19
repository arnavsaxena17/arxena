import { isDefined } from 'twenty-shared/utils';

export type ProfileSource = 'bright_data' | 'harvest';

// The one otherFields key a fetched profile is written under. A single key keeps
// the project table to one extra column, and the column's value carries its own
// provenance so the scorer knows what it could and could not judge.
export const PROFILE_FIELD_KEY = 'profile';

export type RowProfile = {
  source: ProfileSource;
  fetchedAt: string;
  // Which parts the source returned: a missing part is unknown, not absent
  fieldsPresent: string[];
  headline?: string;
  about?: string;
  experience?: string;
  education?: string;
  location?: string;
  followers?: number;
  connections?: number;
  hasPhoto?: boolean;
};

const MAX_ABOUT_CHARS = 800;
const MAX_EXPERIENCE_ENTRIES = 8;
const MAX_EDUCATION_ENTRIES = 4;

type Loose = Record<string, unknown>;

const asRecord = (value: unknown): Loose =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Loose)
    : {};

const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const firstText = (record: Loose, keys: string[]): string => {
  for (const key of keys) {
    const value = text(record[key]);

    if (value !== '') {
      return value;
    }
  }

  return '';
};

const count = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const entries = (value: unknown): Loose[] =>
  Array.isArray(value) ? value.map(asRecord) : [];

const experienceLine = (entry: Loose): string => {
  const title = firstText(entry, ['title', 'position', 'role']);
  const company = firstText(entry, ['company', 'companyName', 'company_name']);
  const start = firstText(entry, ['start_date', 'startDate']);
  const end = firstText(entry, ['end_date', 'endDate']);
  const duration = firstText(entry, ['duration']);
  const when =
    start !== '' || end !== ''
      ? `${start || '?'} - ${end || 'present'}`
      : duration;
  const head = [title, company].filter((part) => part !== '').join(' @ ');

  return head === '' ? '' : when === '' ? head : `${head} (${when})`;
};

const educationLine = (entry: Loose): string => {
  const school = firstText(entry, ['title', 'schoolName', 'school', 'name']);
  const degree = firstText(entry, ['degree', 'degreeName', 'field']);
  const year = firstText(entry, ['end_year', 'endYear', 'endDate']);

  return [school, degree, year].filter((part) => part !== '').join(', ');
};

const joinLines = (lines: string[], limit: number): string =>
  lines
    .filter((line) => line !== '')
    .slice(0, limit)
    .join('; ');

// Both providers' profile shapes reduced to the same compact object. Fields the
// provider did not return are left out and not listed in fieldsPresent.
export const profileToRowProfile = ({
  source,
  record,
  fetchedAt,
}: {
  source: ProfileSource;
  record: unknown;
  fetchedAt: string;
}): RowProfile => {
  const profile = asRecord(record);
  const present: string[] = [];
  const result: RowProfile = { source, fetchedAt, fieldsPresent: present };
  const headline = firstText(profile, ['headline']);
  const about = firstText(profile, ['about', 'summary']);
  const experience = joinLines(
    entries(profile.experience ?? profile.experiences).map(experienceLine),
    MAX_EXPERIENCE_ENTRIES,
  );
  const education = joinLines(
    entries(profile.education ?? profile.educations).map(educationLine),
    MAX_EDUCATION_ENTRIES,
  );
  const location = firstText(profile, ['location', 'city']);
  const followers = count(profile.followers);
  const connections = count(profile.connections);
  const photo = firstText(profile, [
    'avatar',
    'photo',
    'profile_pic_url',
    'profilePicture',
  ]);

  if (headline !== '') {
    result.headline = headline;
    present.push('headline');
  }

  if (about !== '') {
    result.about =
      about.length > MAX_ABOUT_CHARS
        ? `${about.slice(0, MAX_ABOUT_CHARS)}...`
        : about;
    present.push('about');
  }

  if (experience !== '') {
    result.experience = experience;
    present.push('experience');
  }

  if (education !== '') {
    result.education = education;
    present.push('education');
  }

  if (location !== '') {
    result.location = location;
    present.push('location');
  }

  if (isDefined(followers)) {
    result.followers = followers;
    present.push('followers');
  }

  if (isDefined(connections)) {
    result.connections = connections;
    present.push('connections');
  }

  // Whether there is a photo is a fact only when the provider reports on it
  if (source === 'bright_data' || photo !== '') {
    result.hasPhoto = photo !== '';
    present.push('photo');
  }

  return result;
};

// A profile counts as fetched only when the source returned something to judge
export const isUsableProfile = (profile: RowProfile): boolean =>
  profile.fieldsPresent.some((field) =>
    ['about', 'experience', 'education', 'headline'].includes(field),
  );

export const readRowProfile = (
  otherFields: Record<string, unknown>,
): RowProfile | undefined => {
  const value = asRecord(otherFields[PROFILE_FIELD_KEY]);

  return typeof value.fetchedAt === 'string' &&
    (value.source === 'bright_data' || value.source === 'harvest')
    ? (value as unknown as RowProfile)
    : undefined;
};
