export type PeopleSearchParameterType =
  | 'job_titles_companies_location'
  | 'job_titles_location'
  | 'keywords_location'
  | 'job_titles_industry_location'
  | 'keywords_industry_location';

export const PEOPLE_SEARCH_PARAMETER_TYPES: PeopleSearchParameterType[] = [
  'job_titles_companies_location',
  'job_titles_location',
  'keywords_location',
  'job_titles_industry_location',
  'keywords_industry_location',
];

export const PEOPLE_SEARCH_PARAMETER_TYPE_DESCRIPTIONS: Record<
  PeopleSearchParameterType,
  string
> = {
  job_titles_companies_location:
    'Use job titles in keywords, company filter, and location. No industry.',
  job_titles_location:
    'Use job titles in keywords and location only. No company, no industry.',
  keywords_location:
    'Use skills/boolean keywords only (no job titles) and location. No company, no industry.',
  job_titles_industry_location:
    'Use job titles in keywords, industry filter, and location. No company.',
  keywords_industry_location:
    'Use skills/boolean keywords only (no job titles), industry filter, and location. No company.',
};
