import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

const TITLE_OTHER_FIELD_KEYS = [
  'job_title',
  'jobTitle',
  'headline',
  'linkedin_headline',
  'linkedinHeadline',
  'profile_headline',
  'profileHeadline',
] as const;

const COMPANY_OTHER_FIELD_KEYS = [
  'job_company_name',
  'jobCompanyName',
  'company_name',
  'companyName',
  'company',
] as const;

const readTrimmedString = (value: unknown): string | null => {
  if (isNonEmptyString(value)) {
    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : null;
  }

  if (isDefined(value) && typeof value === 'object' && !Array.isArray(value)) {
    return readTrimmedString((value as { name?: unknown }).name);
  }

  return null;
};

const readFirstOtherFieldsString = (
  otherFields: Record<string, unknown> | null | undefined,
  keys: readonly string[],
): string | null => {
  if (!isDefined(otherFields)) {
    return null;
  }

  for (const key of keys) {
    const value = readTrimmedString(otherFields[key]);

    if (isDefined(value)) {
      return value;
    }
  }

  return null;
};

// LinkedIn harvest stores current role under experience[0].{title,company}.name
const readExperienceField = (
  otherFields: Record<string, unknown> | null | undefined,
  fieldNames: readonly string[],
): string | null => {
  if (!isDefined(otherFields)) {
    return null;
  }

  const experience = otherFields.experience;

  if (!Array.isArray(experience) || experience.length === 0) {
    return null;
  }

  const firstExperience = experience[0];

  if (!isDefined(firstExperience) || typeof firstExperience !== 'object') {
    return null;
  }

  const experienceRecord = firstExperience as Record<string, unknown>;

  for (const fieldName of fieldNames) {
    const value = readTrimmedString(experienceRecord[fieldName]);

    if (isDefined(value)) {
      return value;
    }
  }

  return null;
};

export type CandidateTitleCompanySource = {
  jobTitle?: string | null;
  jobCompanyName?: string | null;
  otherFields?: Record<string, unknown> | null;
};

export type PersonTitleCompanyPatch = {
  jobTitle?: string;
  jobCompanyName?: string;
};

export const readPersonTitleCompanyFromCandidate = (
  candidate: CandidateTitleCompanySource,
): PersonTitleCompanyPatch => {
  const jobTitle =
    readTrimmedString(candidate.jobTitle) ??
    readFirstOtherFieldsString(candidate.otherFields, TITLE_OTHER_FIELD_KEYS) ??
    readExperienceField(candidate.otherFields, [
      'title',
      'job_title',
      'jobTitle',
    ]);

  const jobCompanyName =
    readTrimmedString(candidate.jobCompanyName) ??
    readFirstOtherFieldsString(
      candidate.otherFields,
      COMPANY_OTHER_FIELD_KEYS,
    ) ??
    readExperienceField(candidate.otherFields, [
      'company',
      'company_name',
      'companyName',
      'job_company_name',
    ]);

  return {
    ...(isDefined(jobTitle) ? { jobTitle } : {}),
    ...(isDefined(jobCompanyName) ? { jobCompanyName } : {}),
  };
};
