import {
  type BrightDataLudicrousEntity,
  type BrightDataLudicrousFieldDefinition,
} from 'src/engine/core-modules/bright-data/ludicrous/types/bright-data-ludicrous.types';

// Verified against the live API on 2026-10-07. The API never errors on an
// unknown value, it just returns 0 rows, so every fixed value here matters.

export const BRIGHT_DATA_ORGANIZATION_TYPES = [
  'Privately Held',
  'Public Company',
  'Nonprofit',
  'Educational',
  'Self-Employed',
  'Government Agency',
  // Missing from Bright Data's docs but holds 1.6M rows
  'Partnership',
] as const;

// debt and crowdfunding are in the docs but currently match 0 rows
export const BRIGHT_DATA_FUNDING_STAGES = [
  'pre-seed',
  'seed',
  'angel',
  'series-a',
  'series-b',
  'series-c',
  'series-d',
  'series-e',
  'series-unknown',
  'grant',
  'convertible-note',
  'non-equity-assistance',
  'corporate-round',
  'private-equity',
  'undisclosed',
] as const;

// LinkedIn employee-count buckets. company_size_from is the bucket start.
export const BRIGHT_DATA_COMPANY_SIZE_BUCKETS = [
  { from: 1, to: 1, label: 'self-employed' },
  { from: 2, to: 10, label: '2-10' },
  { from: 11, to: 50, label: '11-50' },
  { from: 51, to: 200, label: '51-200' },
  { from: 201, to: 500, label: '201-500' },
  { from: 501, to: 1000, label: '501-1000' },
  { from: 1001, to: 5000, label: '1001-5000' },
  { from: 5001, to: 10000, label: '5001-10000' },
  { from: 10001, to: null, label: '10001+' },
] as const;

export const BRIGHT_DATA_COMPANY_SIZE_FROM_VALUES =
  BRIGHT_DATA_COMPANY_SIZE_BUCKETS.map((bucket) => bucket.from);

// Company HQ city is spelling and case sensitive (Bengaluru 37k vs Bangalore
// 104k). Each group is every spelling worth matching for one place.
export const BRIGHT_DATA_COMPANY_CITY_VARIANTS: Record<string, string[]> = {
  bengaluru: ['Bengaluru', 'Bangalore'],
  bangalore: ['Bengaluru', 'Bangalore'],
  gurugram: ['Gurugram', 'Gurgaon'],
  gurgaon: ['Gurugram', 'Gurgaon'],
  mumbai: ['Mumbai', 'Bombay'],
  bombay: ['Mumbai', 'Bombay'],
  chennai: ['Chennai', 'Madras'],
  madras: ['Chennai', 'Madras'],
  kolkata: ['Kolkata', 'Calcutta'],
  calcutta: ['Kolkata', 'Calcutta'],
  delhi: ['New Delhi', 'Delhi'],
  'new delhi': ['New Delhi', 'Delhi'],
  pune: ['Pune'],
  hyderabad: ['Hyderabad'],
  noida: ['Noida'],
  'new york': ['New York', 'New York City'],
  'new york city': ['New York', 'New York City'],
  'san francisco': ['San Francisco'],
  london: ['London'],
  singapore: ['Singapore'],
};

// People city uses one canonical spelling: Bangalore matches 0 rows there.
export const BRIGHT_DATA_PEOPLE_CITY_CANONICAL: Record<string, string> = {
  bengaluru: 'Bengaluru',
  bangalore: 'Bengaluru',
  gurugram: 'Gurugram',
  gurgaon: 'Gurugram',
  mumbai: 'Mumbai',
  bombay: 'Mumbai',
  delhi: 'Delhi',
  'new delhi': 'New Delhi',
  pune: 'Pune',
  hyderabad: 'Hyderabad',
  chennai: 'Chennai',
  noida: 'Noida',
};

// Country values are ISO 3166-1 alpha-2, matched case-insensitively. These are
// the aliases that LLMs and humans use that match nothing (or the wrong rows).
export const BRIGHT_DATA_COUNTRY_ALIASES: Record<string, string> = {
  uk: 'GB',
  'united kingdom': 'GB',
  england: 'GB',
  usa: 'US',
  'united states': 'US',
  america: 'US',
  india: 'IN',
  uae: 'AE',
  'united arab emirates': 'AE',
  singapore: 'SG',
  germany: 'DE',
  france: 'FR',
  canada: 'CA',
  australia: 'AU',
  netherlands: 'NL',
  indonesia: 'ID',
  brazil: 'BR',
  japan: 'JP',
  china: 'CN',
};

// Common LinkedIn industry names, used as prompt guidance. Industry is a text
// field (bag-of-words), so this is a hint list and not an enforced enum.
export const BRIGHT_DATA_LINKEDIN_INDUSTRIES_HINT = [
  'Software Development',
  'IT Services and IT Consulting',
  'Technology, Information and Internet',
  'Financial Services',
  'Banking',
  'Insurance',
  'Venture Capital and Private Equity Principals',
  'Investment Banking',
  'Hospitals and Health Care',
  'Medical Equipment Manufacturing',
  'Pharmaceutical Manufacturing',
  'Biotechnology Research',
  'Retail',
  'Retail Apparel and Fashion',
  'E-commerce',
  'Consumer Goods',
  'Food and Beverage Manufacturing',
  'Restaurants',
  'Manufacturing',
  'Automotive',
  'Motor Vehicle Manufacturing',
  'Oil and Gas',
  'Renewable Energy Power Generation',
  'Semiconductor Manufacturing',
  'Utilities',
  'Construction',
  'Real Estate',
  'Hospitality',
  'Travel Arrangements',
  'Airlines and Aviation',
  'Transportation, Logistics, Supply Chain and Storage',
  'Telecommunications',
  'Media and Telecommunications',
  'Advertising Services',
  'Marketing Services',
  'Public Relations and Communications Services',
  'Business Consulting and Services',
  'Staffing and Recruiting',
  'Human Resources Services',
  'Legal Services',
  'Accounting',
  'Education',
  'E-Learning Providers',
  'Higher Education',
  'Government Administration',
  'Non-profit Organizations',
  'Computer Hardware Manufacturing',
  'Computer and Network Security',
  'Data Infrastructure and Analytics',
  'Internet Marketplace Platforms',
  'Mobile Gaming Apps',
  'Entertainment Providers',
  'Wellness and Fitness Services',
  'Agriculture',
  'Chemical Manufacturing',
  'Mining',
  'Design Services',
  'Architecture and Planning',
  'Environmental Services',
] as const;

const TEXT_ONLY = ['text'] as const;
const STRING_EQUALITY = ['equals', 'in'] as const;
const INTEGER_RANGE = ['range', 'equals'] as const;

export const BRIGHT_DATA_LUDICROUS_COMPANY_FIELDS: Record<
  string,
  BrightDataLudicrousFieldDefinition
> = {
  industry: {
    kind: 'text',
    operators: TEXT_ONLY,
    description: 'LinkedIn industry name, e.g. Software Development',
  },
  name: { kind: 'text', operators: TEXT_ONLY, description: 'Company name' },
  about: { kind: 'text', operators: TEXT_ONLY, description: 'About text' },
  slogan: { kind: 'text', operators: TEXT_ONLY, description: 'Tagline' },
  specialties: {
    kind: 'text',
    operators: TEXT_ONLY,
    description: 'Comma-separated specialties',
  },
  headquarters_location: {
    kind: 'text',
    operators: TEXT_ONLY,
    description: 'Free-text HQ location, e.g. "Bangalore, Karnataka"',
  },
  headquarters_country_code: {
    kind: 'string',
    operators: STRING_EQUALITY,
    description: 'ISO alpha-2 country code of the HQ',
  },
  headquarters_city: {
    kind: 'string',
    operators: STRING_EQUALITY,
    description: 'Case and spelling sensitive HQ city',
  },
  offices_country_codes: {
    kind: 'array',
    operators: ['in'],
    description: 'ISO alpha-2 codes of all offices',
  },
  offices_cities: {
    kind: 'array',
    operators: ['in'],
    description: 'Cities of all offices',
  },
  organization_type: {
    kind: 'string',
    operators: STRING_EQUALITY,
    fixedValues: BRIGHT_DATA_ORGANIZATION_TYPES,
    description: 'LinkedIn organization type',
  },
  founded_year: {
    kind: 'integer',
    operators: INTEGER_RANGE,
    description: 'Year founded',
  },
  employees_in_linkedin: {
    kind: 'integer',
    operators: INTEGER_RANGE,
    description: 'Actual count of LinkedIn members at the company',
  },
  company_size_from: {
    kind: 'integer',
    operators: INTEGER_RANGE,
    fixedValues: BRIGHT_DATA_COMPANY_SIZE_FROM_VALUES,
    description: 'Start of the LinkedIn employee-count bucket',
  },
  company_size_to: {
    kind: 'integer',
    operators: INTEGER_RANGE,
    description: 'End of the LinkedIn employee-count bucket',
  },
  funding_stage: {
    kind: 'string',
    operators: STRING_EQUALITY,
    fixedValues: BRIGHT_DATA_FUNDING_STAGES,
    description: 'Latest funding stage',
  },
  funding_raised: {
    kind: 'integer',
    operators: INTEGER_RANGE,
    description: 'Total funding raised in USD',
  },
  linkedin_followers: {
    kind: 'integer',
    operators: INTEGER_RANGE,
    description: 'LinkedIn follower count',
  },
};

export const BRIGHT_DATA_LUDICROUS_PEOPLE_FIELDS: Record<
  string,
  BrightDataLudicrousFieldDefinition
> = {
  current_title: {
    kind: 'text',
    operators: TEXT_ONLY,
    description: 'Current job title (bag of words, no boolean syntax)',
  },
  all_text: { kind: 'text', operators: TEXT_ONLY, description: 'Any text' },
  name: { kind: 'text', operators: TEXT_ONLY, description: 'Person name' },
  about: { kind: 'text', operators: TEXT_ONLY, description: 'About text' },
  location: {
    kind: 'text',
    operators: TEXT_ONLY,
    description: 'Free-text location',
  },
  current_company_name: {
    kind: 'text',
    operators: TEXT_ONLY,
    description: 'Current employer name',
  },
  current_company_industry: {
    kind: 'text',
    operators: TEXT_ONLY,
    description: 'Current employer industry',
  },
  past_job_titles: {
    kind: 'text',
    operators: TEXT_ONLY,
    description: 'Previous job titles',
  },
  past_company_names: {
    kind: 'text',
    operators: TEXT_ONLY,
    description: 'Previous employers',
  },
  certification_names: {
    kind: 'text',
    operators: TEXT_ONLY,
    description: 'Certifications',
  },
  role: { kind: 'text', operators: TEXT_ONLY, description: 'Role' },
  company: { kind: 'text', operators: TEXT_ONLY, description: 'Any company' },
  skill: { kind: 'text', operators: TEXT_ONLY, description: 'Skill' },
  city: {
    kind: 'string',
    operators: STRING_EQUALITY,
    description: 'Canonical city (Bengaluru, not Bangalore)',
  },
  country_code: {
    kind: 'string',
    operators: STRING_EQUALITY,
    description: 'ISO alpha-2 country code',
  },
  followers: {
    kind: 'integer',
    operators: ['range'],
    description: 'LinkedIn follower count',
  },
};

export const BRIGHT_DATA_LUDICROUS_FIELDS: Record<
  BrightDataLudicrousEntity,
  Record<string, BrightDataLudicrousFieldDefinition>
> = {
  company: BRIGHT_DATA_LUDICROUS_COMPANY_FIELDS,
  people: BRIGHT_DATA_LUDICROUS_PEOPLE_FIELDS,
};

// Fields requested instead of view=full. Cuts payload and keeps mapping stable.
export const BRIGHT_DATA_LUDICROUS_DEFAULT_VIEW_FIELDS: Record<
  BrightDataLudicrousEntity,
  string[]
> = {
  company: [
    'name',
    'url',
    'website',
    'domain',
    'industry',
    'organization_type',
    'headquarters_country_code',
    'headquarters_city',
    'headquarters_location',
    'employees_in_linkedin',
    'company_size_from',
    'company_size_to',
    'founded_year',
    'linkedin_followers',
    'about',
  ],
  people: [
    'name',
    'first_name',
    'url',
    'current_title',
    'current_company_name',
    'current_company_id',
    'location',
    'city',
    'country_code',
    'about',
    'followers',
  ],
};
