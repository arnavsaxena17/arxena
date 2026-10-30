// What each sourcing source can actually be asked for, per entity. This is the
// map between a user's words ("₹800 Cr company", "retail stores") and a filter a
// source really has: Bright Data has employee count and an industry label, Sales
// Navigator (Harvest or the user's own account) has revenue and department
// headcount, Google has none of it.
//
// Kept next to sourcing-sources.constant.ts, which says what a source costs and
// how to call it; this one says what it can filter on and what it returns.
//
// Field names are canonical across sources, so `want: ["annualRevenue"]` can be
// answered by any source that has it.

export type CapabilityKind =
  | 'text'
  | 'enum'
  | 'range'
  | 'id'
  | 'idOrUrl'
  | 'boolean';

export type CapabilityField = {
  field: string;
  label: string;
  kind: CapabilityKind;
  // Fixed choices a question can offer
  values?: string[];
  unit?: string;
  // Where the ids or labels come from, when they are not in `values`
  valuesFrom?: 'linkedin-industries' | 'industry-labels' | 'linkedin-locations' | 'title-taxonomy';
  note?: string;
};

export type SourceCapability = {
  // SOURCING_SOURCES key
  key: string;
  entity: 'company' | 'person';
  searchable: CapabilityField[];
  // Fields a user commonly expects that this source does not have
  notSearchable?: Array<{ field: string; nearest?: string; why: string }>;
  // What a row from this source carries into other sources
  returns: string[];
};

export const LINKEDIN_HEADCOUNT_BANDS = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1001-5000',
  '5001-10000',
  '10001+',
];

const COMPANY_FIELDS = {
  employees: {
    field: 'employees',
    label: 'Employee count',
    kind: 'enum',
    values: LINKEDIN_HEADCOUNT_BANDS,
  },
  annualRevenue: {
    field: 'annualRevenue',
    label: 'Annual revenue',
    kind: 'range',
    unit: 'USD millions',
  },
  industry: {
    field: 'industry',
    label: 'Industry',
    kind: 'enum',
    valuesFrom: 'linkedin-industries',
  },
  hqLocation: {
    field: 'hqLocation',
    label: 'Headquarters location',
    kind: 'text',
  },
  keywords: {
    field: 'keywords',
    label: 'Keywords (about, products, specialties)',
    kind: 'text',
  },
  departmentHeadcount: {
    field: 'departmentHeadcount',
    label: 'Department headcount',
    kind: 'range',
  },
  hiring: {
    field: 'hiring',
    label: 'Hiring on LinkedIn',
    kind: 'boolean',
  },
} as const satisfies Record<string, CapabilityField>;

const PERSON_FIELDS = {
  currentTitle: {
    field: 'currentTitle',
    label: 'Current job title',
    kind: 'text',
    valuesFrom: 'title-taxonomy',
  },
  currentCompany: {
    field: 'currentCompany',
    label: 'Current company (id or LinkedIn URL)',
    kind: 'idOrUrl',
  },
  companyHeadcount: {
    field: 'companyHeadcount',
    label: 'Employer headcount',
    kind: 'enum',
    values: LINKEDIN_HEADCOUNT_BANDS,
  },
  location: {
    field: 'location',
    label: 'Location',
    kind: 'text',
    valuesFrom: 'linkedin-locations',
  },
  seniority: {
    field: 'seniority',
    label: 'Seniority',
    kind: 'id',
  },
  function: {
    field: 'function',
    label: 'Function',
    kind: 'id',
  },
  industry: {
    field: 'industry',
    label: 'Employer industry',
    kind: 'enum',
    valuesFrom: 'linkedin-industries',
  },
  yearsExperience: {
    field: 'yearsExperience',
    label: 'Years of experience',
    kind: 'range',
    unit: 'years',
  },
} as const satisfies Record<string, CapabilityField>;

export const SOURCE_CAPABILITIES: readonly SourceCapability[] = [
  {
    key: 'bright-data',
    entity: 'company',
    searchable: [
      COMPANY_FIELDS.keywords,
      COMPANY_FIELDS.industry,
      COMPANY_FIELDS.hqLocation,
      COMPANY_FIELDS.employees,
    ],
    notSearchable: [
      {
        field: 'annualRevenue',
        nearest: 'employees',
        why: 'Bright Data company records carry employee count, not revenue',
      },
      {
        field: 'departmentHeadcount',
        nearest: 'employees',
        why: 'Bright Data has no function-level headcount',
      },
      {
        field: 'hiring',
        why: 'Bright Data does not say whether the company is hiring',
      },
    ],
    returns: ['name', 'domain', 'linkedinUrl', 'employees', 'industry', 'hqCity', 'hqCountry', 'about'],
  },
  {
    key: 'bright-data',
    entity: 'person',
    searchable: [
      PERSON_FIELDS.currentTitle,
      PERSON_FIELDS.currentCompany,
      PERSON_FIELDS.location,
    ],
    returns: ['name', 'title', 'company', 'linkedinUrl', 'location', 'profile'],
  },
  {
    key: 'serp',
    entity: 'company',
    searchable: [COMPANY_FIELDS.keywords],
    notSearchable: [
      {
        field: 'employees',
        why: 'Google has no company attributes; it returns pages',
      },
      {
        field: 'annualRevenue',
        why: 'Google returns pages, not a revenue field; a figure has to be read from a page',
      },
      {
        field: 'industry',
        why: 'Google does not filter by industry label',
      },
    ],
    returns: ['websiteUrl', 'linkedinUrl', 'pageTitle', 'snippet'],
  },
  {
    key: 'serp',
    entity: 'person',
    searchable: [PERSON_FIELDS.currentTitle, PERSON_FIELDS.currentCompany, PERSON_FIELDS.location],
    returns: ['name', 'title', 'company', 'linkedinUrl', 'snippet'],
  },
  {
    key: 'linkedin',
    entity: 'company',
    searchable: [
      COMPANY_FIELDS.employees,
      COMPANY_FIELDS.annualRevenue,
      COMPANY_FIELDS.industry,
      COMPANY_FIELDS.hqLocation,
      COMPANY_FIELDS.departmentHeadcount,
      COMPANY_FIELDS.hiring,
    ],
    returns: ['name', 'linkedinUrl', 'employees', 'annualRevenue', 'industry', 'hqLocation', 'departmentHeadcount'],
  },
  {
    key: 'linkedin',
    entity: 'person',
    searchable: [
      PERSON_FIELDS.currentTitle,
      PERSON_FIELDS.currentCompany,
      PERSON_FIELDS.companyHeadcount,
      PERSON_FIELDS.location,
      PERSON_FIELDS.seniority,
      PERSON_FIELDS.function,
      PERSON_FIELDS.industry,
    ],
    returns: ['name', 'title', 'company', 'linkedinUrl', 'location', 'profile'],
  },
  {
    key: 'harvest',
    entity: 'company',
    searchable: [
      COMPANY_FIELDS.employees,
      COMPANY_FIELDS.annualRevenue,
      COMPANY_FIELDS.industry,
      COMPANY_FIELDS.hqLocation,
      COMPANY_FIELDS.departmentHeadcount,
      COMPANY_FIELDS.hiring,
    ],
    returns: ['name', 'linkedinUrl', 'employees', 'annualRevenue', 'industry', 'hqLocation', 'departmentHeadcount'],
  },
  {
    key: 'harvest',
    entity: 'person',
    searchable: [
      PERSON_FIELDS.currentTitle,
      PERSON_FIELDS.currentCompany,
      PERSON_FIELDS.companyHeadcount,
      PERSON_FIELDS.location,
      PERSON_FIELDS.seniority,
      PERSON_FIELDS.function,
      PERSON_FIELDS.industry,
    ],
    returns: ['name', 'title', 'company', 'linkedinUrl', 'location'],
  },
  {
    key: 'internal-index',
    entity: 'company',
    searchable: [
      COMPANY_FIELDS.keywords,
      COMPANY_FIELDS.industry,
      COMPANY_FIELDS.employees,
    ],
    notSearchable: [
      {
        field: 'annualRevenue',
        nearest: 'employees',
        why: 'The Arxena index is name, website, LinkedIn URL, industry and size only',
      },
    ],
    returns: ['name', 'domain', 'linkedinUrl', 'industry', 'employees'],
  },
  {
    key: 'google-maps',
    entity: 'company',
    searchable: [COMPANY_FIELDS.keywords, COMPANY_FIELDS.hqLocation],
    notSearchable: [
      {
        field: 'employees',
        why: 'Maps listings have no employee count',
      },
      {
        field: 'annualRevenue',
        why: 'Maps listings have no revenue',
      },
    ],
    returns: ['name', 'address', 'websiteUrl', 'category'],
  },
  {
    key: 'naukri',
    entity: 'person',
    searchable: [
      PERSON_FIELDS.currentTitle,
      PERSON_FIELDS.location,
      PERSON_FIELDS.yearsExperience,
    ],
    returns: ['name', 'title', 'company', 'location', 'experienceYears'],
  },
  {
    key: 'apollo',
    entity: 'company',
    searchable: [
      COMPANY_FIELDS.employees,
      COMPANY_FIELDS.annualRevenue,
      COMPANY_FIELDS.industry,
      COMPANY_FIELDS.hqLocation,
      COMPANY_FIELDS.keywords,
    ],
    returns: ['name', 'domain', 'linkedinUrl', 'employees', 'annualRevenue', 'industry', 'hqLocation'],
  },
  {
    key: 'apollo',
    entity: 'person',
    searchable: [
      PERSON_FIELDS.currentTitle,
      PERSON_FIELDS.currentCompany,
      PERSON_FIELDS.location,
      PERSON_FIELDS.seniority,
    ],
    returns: ['name', 'title', 'company', 'linkedinUrl', 'location', 'email'],
  },
  {
    key: 'exa',
    entity: 'company',
    searchable: [COMPANY_FIELDS.keywords],
    returns: ['name', 'websiteUrl', 'about'],
  },
  {
    key: 'wikidata',
    entity: 'company',
    searchable: [COMPANY_FIELDS.keywords],
    returns: ['name', 'websiteUrl', 'industry', 'employees', 'hqLocation'],
  },
];

// One source's output that another source accepts as an input. Code fills these
// in; the model never has to know that Harvest wants `currentCompanies` or that
// Sales Navigator wants facet ids.
export type SourceHandoff = {
  from: string;
  field: string;
  to: string;
  toField: string;
  note: string;
};

export const SOURCE_HANDOFFS: readonly SourceHandoff[] = [
  {
    from: 'bright-data',
    field: 'linkedinUrl',
    to: 'harvest',
    toField: 'currentCompanies',
    note: 'Harvest lead search takes the company LinkedIn URL directly',
  },
  {
    from: 'bright-data',
    field: 'linkedinUrl',
    to: 'linkedin',
    toField: 'company',
    note: 'Resolve the URL to a company id with generate_linkedin_query_set',
  },
  {
    from: 'bright-data',
    field: 'domain',
    to: 'bright-data',
    toField: 'companySite',
    note: 'The website reads a leadership page and confirms a namesake',
  },
  {
    from: 'bright-data',
    field: 'industry',
    to: 'harvest',
    toField: 'industryIds',
    note: 'The label maps to a Sales Navigator industry id via search_linkedin_parameters',
  },
  {
    from: 'bright-data',
    field: 'name',
    to: 'raw-name-resolver',
    toField: 'rawName',
    note: 'Resolve a messy or uploaded name to a domain before any spend',
  },
  {
    from: 'bright-data',
    field: 'linkedinUrl',
    to: 'bright-data',
    toField: 'personProfile',
    note: 'A person LinkedIn URL fetches the full profile',
  },
];

// The searchable stand-in when a source has no such field, used to build the
// "which of these instead" question
export const CAPABILITY_PROXIES: Readonly<Record<string, string>> = {
  annualRevenue: 'employees',
  departmentHeadcount: 'employees',
  hiring: 'keywords',
  yearsExperience: 'seniority',
};

export const findCapability = (
  sourceKey: string,
  entity: 'company' | 'person',
): SourceCapability | undefined =>
  SOURCE_CAPABILITIES.find(
    (capability) =>
      capability.key === sourceKey && capability.entity === entity,
  );
