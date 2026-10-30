import {
  type ResultDimension,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/sourcing-result-fields.constant';
import {
  PROFILE_FIELD_KEY,
  readRowProfile,
  type RowProfile,
} from 'src/engine/core-modules/candidate-sourcing/services/profile-fetch/profile-row-fields.util';

// What a row can answer right now, from the fields it actually holds. The
// registry says what a source *can* return; this says what this row *did*.
// Two rows from the same source differ, so the plan is computed per row.

export type RowCoverage = {
  level: 'snapshot' | 'profile' | 'company_web';
  answered: ResultDimension[];
  // Field present but weak (a headline is not a confirmed title)
  partial: ResultDimension[];
  blind: ResultDimension[];
};

const PERSON_DIMENSIONS: ResultDimension[] = [
  'identity',
  'role',
  'tenure',
  'location',
  'employerIdentity',
  'employerIndustry',
  'employerSize',
  'employerRevenue',
  'skills',
  'contact',
  'evidence',
];

const COMPANY_DIMENSIONS: ResultDimension[] = [
  'identity',
  'employerIndustry',
  'employerSize',
  'employerRevenue',
  'location',
  'evidence',
];

const nonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};

const build = (
  dimensions: ResultDimension[],
  answered: ResultDimension[],
  partial: ResultDimension[],
  level: RowCoverage['level'],
): RowCoverage => {
  const settled = new Set([...answered, ...partial]);

  return {
    level,
    answered: [...new Set(answered)],
    partial: [...new Set(partial)].filter((entry) => !answered.includes(entry)),
    blind: dimensions.filter((dimension) => !settled.has(dimension)),
  };
};

export type PersonRowInput = {
  title?: string;
  companyName?: string;
  locationName?: string;
  linkedinUrl?: string;
  otherFields?: Record<string, unknown>;
};

export const readPersonCoverage = (row: PersonRowInput): RowCoverage => {
  const otherFields = asRecord(row.otherFields);
  const profile: RowProfile | undefined = readRowProfile(otherFields);
  const answered: ResultDimension[] = ['identity'];
  const partial: ResultDimension[] = [];

  if (nonEmptyString(row.companyName)) {
    answered.push('employerIdentity');
  }
  if (nonEmptyString(row.locationName)) {
    answered.push('location');
  }
  if (nonEmptyString(row.title)) {
    // A row title comes from a search result; only the profile confirms it
    partial.push('role');
  }

  if (profile !== undefined) {
    const fields = new Set(profile.fieldsPresent);

    answered.push('evidence');
    if (nonEmptyString(profile.headline) || fields.has('headline')) {
      answered.push('role');
    }
    if (nonEmptyString(profile.experience) || fields.has('experience')) {
      answered.push('tenure', 'employerIdentity');
    }
    if (nonEmptyString(profile.about) || fields.has('about')) {
      answered.push('skills');
    }
    if (nonEmptyString(profile.location)) {
      answered.push('location');
    }

    return build(PERSON_DIMENSIONS, answered, partial, 'profile');
  }

  answered.push('evidence');

  return build(PERSON_DIMENSIONS, answered, partial, 'snapshot');
};

export type CompanyRowInput = {
  industry?: string;
  employees?: string | number;
  otherFields?: Record<string, unknown>;
};

const readRevenue = (otherFields: Record<string, unknown>): boolean => {
  const keys = [
    'annualRevenue',
    'annualRevenueInrCrore',
    'revenue',
    'turnover',
    'revenueUsd',
  ];

  return keys.some((key) => {
    const value = otherFields[key];

    return (
      (typeof value === 'number' && Number.isFinite(value)) ||
      (typeof value === 'string' && value.trim().length > 0 && value !== 'unknown')
    );
  });
};

const readHeadcount = (
  row: CompanyRowInput,
  otherFields: Record<string, unknown>,
): boolean => {
  if (nonEmptyString(row.employees)) {
    return true;
  }

  if (typeof row.employees === 'number' && row.employees > 0) {
    return true;
  }

  return ['employees', 'employeeBand', 'headcount'].some((key) =>
    nonEmptyString(otherFields[key]),
  );
};

const readCompanyLocation = (otherFields: Record<string, unknown>): boolean =>
  ['hqCity', 'headquartersCity', 'city', 'location', 'hqLocation'].some((key) =>
    nonEmptyString(otherFields[key]),
  );

export const readCompanyCoverage = (row: CompanyRowInput): RowCoverage => {
  const otherFields = asRecord(row.otherFields);
  const answered: ResultDimension[] = ['identity'];
  const partial: ResultDimension[] = [];

  if (nonEmptyString(row.industry)) {
    answered.push('employerIndustry');
  } else if (
    nonEmptyString(otherFields.industry) ||
    nonEmptyString(otherFields.about)
  ) {
    partial.push('employerIndustry');
  }

  if (readHeadcount(row, otherFields)) {
    answered.push('employerSize');
  }
  if (readRevenue(otherFields)) {
    answered.push('employerRevenue');
  }
  if (readCompanyLocation(otherFields)) {
    answered.push('location');
  }

  // A row that carries size but no revenue has not been through a web step:
  // revenue is the marker, since that is what no structured source holds
  const level: RowCoverage['level'] = answered.includes('employerRevenue')
    ? 'company_web'
    : 'snapshot';

  return build(COMPANY_DIMENSIONS, answered, partial, level);
};

export const hasProfile = (row: PersonRowInput): boolean =>
  readPersonCoverage(row).level === 'profile';

export { PROFILE_FIELD_KEY };
