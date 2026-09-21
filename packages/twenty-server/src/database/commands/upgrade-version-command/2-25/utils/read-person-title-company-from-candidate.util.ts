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
  if (!isNonEmptyString(value)) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
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
    readFirstOtherFieldsString(candidate.otherFields, TITLE_OTHER_FIELD_KEYS);

  const jobCompanyName =
    readTrimmedString(candidate.jobCompanyName) ??
    readFirstOtherFieldsString(candidate.otherFields, COMPANY_OTHER_FIELD_KEYS);

  return {
    ...(isDefined(jobTitle) ? { jobTitle } : {}),
    ...(isDefined(jobCompanyName) ? { jobCompanyName } : {}),
  };
};
