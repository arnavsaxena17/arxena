import { extractLinkedinProfileId } from 'src/engine/core-modules/outreach-command/utils/extract-linkedin-profile-id.util';
import {
  extractCandidateCompanyName,
  extractCandidateJobTitle,
  extractCompanyFromPositionLike,
  extractCompanyIdFromPositionLike,
  extractTitleFromPositionLike,
} from 'src/engine/core-modules/people-api/utils/extract-candidate-job-title.util';
import {
  flattenCandidateFromMatchedPosition,
  pickCurrentPositionForSearchIntent,
} from 'src/engine/core-modules/people-api/utils/pick-current-position-for-search-intent.util';

export type SearchPeopleExperience = {
  company: string;
  position: string;
  location: string;
  description: string;
  start: string;
  end: string;
  isCurrent: boolean;
  companyId: string;
};

export type SearchPeopleEducation = {
  school: string;
  degree: string;
  fieldOfStudy: string;
  start: string;
  end: string;
};

export type SearchPeopleProfile = {
  name: string;
  firstName: string;
  lastName: string;
  title: string;
  headline: string;
  company: string;
  companyName: string;
  location: string;
  linkedinUrl: string;
  linkedinProfileId: string;
  peopleId: string;
  profilePictureUrl: string;
  source: string;
  stdFunction: string;
  stdFunctionRoot: string;
  stdGrade: string;
  experience: SearchPeopleExperience[];
  education: SearchPeopleEducation[];
  current_positions: unknown[];
};

const readString = (item: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asRecordArray = (value: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (entry): entry is Record<string, unknown> =>
      !!entry && typeof entry === 'object' && !Array.isArray(entry),
  );
};

const formatLinkedInDate = (value: unknown): string => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  const record = asRecord(value);
  if (!record) {
    return '';
  }

  const year = record.year;
  if (typeof year !== 'number' || year < 1) {
    return '';
  }

  const month = record.month;
  if (typeof month === 'number' && month >= 1 && month <= 12) {
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  return String(year);
};

const isTruthyFlag = (value: unknown): boolean =>
  value === true || value === 'true';

const experienceKey = (item: SearchPeopleExperience): string =>
  `${item.position.trim().toLowerCase()}|${item.company.trim().toLowerCase()}|${item.start}`;

const mapExperienceEntry = (
  entry: Record<string, unknown>,
  options?: { assumeCurrent?: boolean },
): SearchPeopleExperience | null => {
  const position = extractTitleFromPositionLike(entry) ?? '';
  const company = extractCompanyFromPositionLike(entry) ?? '';

  if (!position && !company) {
    return null;
  }

  const end =
    formatLinkedInDate(entry.end) ||
    formatLinkedInDate(entry.endDate) ||
    formatLinkedInDate(entry.end_date);
  const isCurrent =
    isTruthyFlag(entry.isCurrent) ||
    isTruthyFlag(entry.is_current) ||
    (options?.assumeCurrent === true && !end) ||
    !end;

  return {
    company,
    position,
    location: readString(entry, ['location', 'locationName']),
    description: readString(entry, ['description', 'summary']),
    start:
      formatLinkedInDate(entry.start) ||
      formatLinkedInDate(entry.startDate) ||
      formatLinkedInDate(entry.start_date),
    end,
    isCurrent,
    companyId: extractCompanyIdFromPositionLike(entry) ?? '',
  };
};

export const mapSearchPeopleExperience = (
  item: Record<string, unknown>,
): SearchPeopleExperience[] => {
  const merged: SearchPeopleExperience[] = [];
  const seen = new Set<string>();
  const sources = [
    asRecordArray(item.current_positions ?? item.currentPositions).map(
      (entry) => mapExperienceEntry(entry, { assumeCurrent: true }),
    ),
    asRecordArray(item.work_experience ?? item.workExperience).map((entry) =>
      mapExperienceEntry(entry),
    ),
    asRecordArray(item.experience).map((entry) => mapExperienceEntry(entry)),
  ];

  for (const source of sources) {
    for (const mapped of source) {
      if (!mapped) {
        continue;
      }
      const key = experienceKey(mapped);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      merged.push(mapped);
    }
  }

  return merged;
};

const mapEducationEntry = (
  entry: Record<string, unknown>,
): SearchPeopleEducation | null => {
  const schoolDetails = asRecord(entry.school_details);
  const school =
    readString(entry, ['school', 'schoolName', 'institute', 'university']) ||
    (schoolDetails ? readString(schoolDetails, ['name']) : '');
  const degree = readString(entry, ['degree', 'degreeName', 'degrees']);
  const fieldOfStudy = readString(entry, [
    'fieldOfStudy',
    'field_of_study',
    'majors',
    'course',
  ]);

  if (!school && !degree && !fieldOfStudy) {
    return null;
  }

  return {
    school,
    degree,
    fieldOfStudy,
    start:
      formatLinkedInDate(entry.start) ||
      formatLinkedInDate(entry.startDate) ||
      formatLinkedInDate(entry.start_date) ||
      formatLinkedInDate(entry.startYear),
    end:
      formatLinkedInDate(entry.end) ||
      formatLinkedInDate(entry.endDate) ||
      formatLinkedInDate(entry.end_date) ||
      formatLinkedInDate(entry.endYear),
  };
};

export const mapSearchPeopleEducation = (
  item: Record<string, unknown>,
): SearchPeopleEducation[] => {
  const entries = [
    ...asRecordArray(item.education),
    ...asRecordArray(item.educations),
  ];
  const mapped: SearchPeopleEducation[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const education = mapEducationEntry(entry);
    if (!education) {
      continue;
    }
    const key = `${education.school}|${education.degree}|${education.start}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    mapped.push(education);
  }

  return mapped;
};

const readTaxonomy = (
  item: Record<string, unknown>,
): {
  stdFunction: string;
  stdFunctionRoot: string;
  stdGrade: string;
} => {
  const resolved = asRecord(item.resolved) ?? item;

  return {
    stdFunction: readString(resolved, ['stdFunction']),
    stdFunctionRoot: readString(resolved, ['stdFunctionRoot']),
    stdGrade: readString(resolved, ['stdGrade']),
  };
};

export const mapSearchPeopleProfile = (
  item: Record<string, unknown>,
  options?: {
    source?: string;
    companyId?: string;
    companyIds?: string[];
    companyName?: string | null;
    companySlug?: string | null;
  },
): SearchPeopleProfile => {
  const firstName = readString(item, ['firstName', 'first_name']);
  const lastName = readString(item, ['lastName', 'last_name']);
  const linkedinUrl = readString(item, [
    'linkedinUrl',
    'linkedin_url',
    'profile_url',
    'profileUrl',
    'public_profile_url',
    'url',
  ]);
  const titleOptions = {
    companyName: options?.companyName,
    companyId: options?.companyId,
    companyIds: options?.companyIds,
    companySlug: options?.companySlug,
  };
  const matchedPosition = pickCurrentPositionForSearchIntent(item, titleOptions);
  const flattened = flattenCandidateFromMatchedPosition(item, matchedPosition);
  const title =
    extractCandidateJobTitle(flattened, titleOptions) ??
    readString(flattened, ['title', 'jobTitle']);
  const headline = readString(flattened, ['headline', 'linkedinHeadline']);
  const companyName =
    extractCandidateCompanyName(flattened, titleOptions) ??
    readString(flattened, ['companyName', 'company', 'org', 'jobCompanyName']);
  const currentPositions = asRecordArray(
    flattened.current_positions ?? flattened.currentPositions,
  );
  const taxonomy = readTaxonomy(flattened);

  return {
    name:
      readString(flattened, ['name', 'fullName', 'full_name']) ||
      [firstName, lastName].filter(Boolean).join(' '),
    firstName,
    lastName,
    title,
    headline,
    company: companyName,
    companyName,
    location: readString(item, ['location', 'locationName']),
    linkedinUrl,
    linkedinProfileId:
      readString(item, [
        'linkedinProfileId',
        'public_identifier',
        'peopleId',
      ]) || extractLinkedinProfileId(linkedinUrl),
    peopleId: readString(item, ['peopleId', 'id']),
    profilePictureUrl: readString(item, [
      'profilePictureUrl',
      'displayPicture',
      'profile_picture_url',
    ]),
    source: readString(item, ['source']) || options?.source || '',
    ...taxonomy,
    experience: mapSearchPeopleExperience(item),
    education: mapSearchPeopleEducation(item),
    current_positions: currentPositions,
  };
};
