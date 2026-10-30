// What a source actually returns, and which scoring dimensions that covers.
// The capability registry says what a source can be *asked* for; this says what
// comes *back*, so the scorer can tell which criteria a row can already answer
// and which need one more step (profile, company web) before they can.
//
// A dimension answered here is settled from the row itself; partial means the
// field exists but is weak (a search headline is not a confirmed title); blind
// means the row cannot answer it at this level, whatever the model believes.

export type ResultDimension =
  | 'identity'
  | 'role'
  | 'tenure'
  | 'location'
  | 'employerIdentity'
  | 'employerIndustry'
  | 'employerSize'
  | 'employerRevenue'
  | 'skills'
  | 'contact'
  | 'evidence';

export type SourceResultLevel = 'snapshot' | 'profile' | 'company_web';

export type SourceResultFields = {
  key: string;
  entity: 'company' | 'person';
  level: SourceResultLevel;
  fields: string[];
  answered: ResultDimension[];
  partial: ResultDimension[];
};

export const SOURCE_RESULT_FIELDS: readonly SourceResultFields[] = [
  {
    key: 'serp',
    entity: 'person',
    level: 'snapshot',
    fields: ['name', 'title', 'company', 'linkedinUrl', 'snippet'],
    answered: ['identity', 'evidence'],
    // The title is read from a result title, not from the profile
    partial: ['role', 'employerIdentity'],
  },
  {
    key: 'bright-data',
    entity: 'person',
    level: 'snapshot',
    fields: ['name', 'title', 'company', 'location', 'linkedinUrl'],
    answered: ['identity', 'location', 'evidence'],
    partial: ['role', 'employerIdentity'],
  },
  {
    key: 'bright-data',
    entity: 'person',
    level: 'profile',
    fields: [
      'name',
      'title',
      'company',
      'location',
      'about',
      'experience',
      'education',
      'followers',
      'connections',
    ],
    answered: [
      'identity',
      'role',
      'tenure',
      'location',
      'employerIdentity',
      'skills',
      'evidence',
    ],
    partial: ['employerIndustry'],
  },
  {
    key: 'linkedin',
    entity: 'person',
    level: 'profile',
    fields: [
      'name',
      'title',
      'company',
      'location',
      'about',
      'experience',
      'education',
    ],
    answered: [
      'identity',
      'role',
      'tenure',
      'location',
      'employerIdentity',
      'skills',
      'evidence',
    ],
    partial: ['employerIndustry'],
  },
  {
    key: 'naukri',
    entity: 'person',
    level: 'snapshot',
    fields: ['name', 'title', 'company', 'location', 'experienceYears'],
    answered: ['identity', 'location'],
    partial: ['role', 'employerIdentity', 'tenure'],
  },
  {
    key: 'bright-data',
    entity: 'company',
    level: 'snapshot',
    fields: ['name', 'domain', 'linkedinUrl', 'industry', 'employees', 'about', 'hqCity', 'hqCountry'],
    answered: ['identity', 'employerIndustry', 'employerSize', 'location', 'evidence'],
    partial: [],
  },
  {
    key: 'internal-index',
    entity: 'company',
    level: 'snapshot',
    fields: ['name', 'domain', 'linkedinUrl', 'industry', 'employees'],
    answered: ['identity', 'employerIndustry', 'employerSize'],
    partial: [],
  },
  {
    key: 'google-maps',
    entity: 'company',
    level: 'snapshot',
    fields: ['name', 'address', 'websiteUrl', 'category'],
    answered: ['identity', 'location'],
    partial: ['employerIndustry'],
  },
  {
    key: 'harvest',
    entity: 'company',
    level: 'company_web',
    fields: [
      'name',
      'linkedinUrl',
      'employees',
      'annualRevenue',
      'industry',
      'hqLocation',
      'departmentHeadcount',
    ],
    answered: [
      'identity',
      'employerIndustry',
      'employerSize',
      'employerRevenue',
      'location',
      'evidence',
    ],
    partial: [],
  },
  {
    key: 'linkedin',
    entity: 'company',
    level: 'company_web',
    fields: [
      'name',
      'linkedinUrl',
      'employees',
      'annualRevenue',
      'industry',
      'hqLocation',
      'departmentHeadcount',
    ],
    answered: [
      'identity',
      'employerIndustry',
      'employerSize',
      'employerRevenue',
      'location',
      'evidence',
    ],
    partial: [],
  },
  {
    key: 'web',
    entity: 'company',
    level: 'company_web',
    // One web-search column reads what no structured source holds
    fields: ['annualRevenue', 'employeeBand', 'ownership', 'hqCity'],
    answered: ['employerRevenue', 'employerSize', 'location'],
    partial: ['employerIndustry'],
  },
];

// What each level can add to a person row it does not already have
export const PROFILE_SETTLES: readonly ResultDimension[] = [
  'role',
  'tenure',
  'location',
  'employerIdentity',
  'skills',
];

// What only a company-level web step can add
export const COMPANY_WEB_SETTLES: readonly ResultDimension[] = [
  'employerRevenue',
  'employerSize',
  'employerIndustry',
  'location',
];

export const findResultFields = (
  key: string,
  entity: 'company' | 'person',
  level: SourceResultLevel,
): SourceResultFields | undefined =>
  SOURCE_RESULT_FIELDS.find(
    (entry) =>
      entry.key === key && entry.entity === entity && entry.level === level,
  );
