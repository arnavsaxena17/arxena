import {
  GTM_FETCH_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME,
  GTM_SEARCH_COMPANIES_LOGIC_FUNCTION_NAME,
  GTM_SEARCH_JOBS_LOGIC_FUNCTION_NAME,
  GTM_SEARCH_PEOPLE_FOR_COMPANY_LOGIC_FUNCTION_NAME,
  GTM_SEARCH_PEOPLE_LOGIC_FUNCTION_NAME,
} from 'src/engine/core-modules/gtm-command/constants/gtm-logic-function-names.const';

export const GTM_SEARCH_PEOPLE_FOR_COMPANY_SAMPLE_OUTPUT = {
  success: true,
  total: 1,
  dataSource: 'unipile',
  projectId: 'project-id',
  error: '',
  people: [
    {
      name: 'Arapa Hara',
      firstName: 'Arapa',
      lastName: 'Hara',
      title: 'Head of Sales',
      headline: 'Head of Sales at Acme',
      company: 'Acme',
      location: 'San Francisco',
      linkedinUrl: 'https://www.linkedin.com/in/example',
      linkedinProfileId: 'example',
      peopleId: 'ACwAAAExample',
      profilePictureUrl: '',
      source: 'linkedin_sales_navigator',
      stdFunction: 'sales',
      stdFunctionRoot: 'go-to-market',
      stdGrade: 'leadership',
    },
  ],
};

export const GTM_FETCH_LINKEDIN_PROFILE_SAMPLE_OUTPUT = {
  success: true,
  linkedinProfileId: 'example',
  headline: 'Head of Sales',
  about: '',
  experience: [],
  snapshot: '{}',
  error: '',
};

export const GTM_SEARCH_PEOPLE_SAMPLE_OUTPUT = {
  success: true,
  total: 1,
  dataSource: 'auto',
  error: '',
  people: [
    {
      name: 'Arapa Hara',
      title: 'Head of Sales',
      linkedinUrl: 'https://www.linkedin.com/in/example',
      companyName: 'Acme',
    },
  ],
};

export const GTM_SEARCH_COMPANIES_SAMPLE_OUTPUT = {
  success: true,
  total: 1,
  dataSource: 'auto',
  error: '',
  companies: [
    {
      id: 'acme',
      name: 'Acme',
      website: 'acme.com',
      linkedinUrl: 'https://www.linkedin.com/company/acme',
      industry: 'Software',
    },
  ],
};

export const GTM_SEARCH_JOBS_SAMPLE_OUTPUT = {
  success: true,
  total: 1,
  dataSource: 'auto',
  error: '',
  jobs: [
    {
      id: 'job-1',
      title: 'Account Executive',
      location: 'San Francisco',
      url: 'https://www.linkedin.com/jobs/view/1',
      companyName: 'Acme',
      postedAt: '2026-08-01',
    },
  ],
};

export const GTM_LOGIC_FUNCTION_SAMPLE_OUTPUT_BY_NAME: Record<
  string,
  Record<string, unknown>
> = {
  [GTM_SEARCH_PEOPLE_FOR_COMPANY_LOGIC_FUNCTION_NAME]:
    GTM_SEARCH_PEOPLE_FOR_COMPANY_SAMPLE_OUTPUT,
  [GTM_FETCH_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME]:
    GTM_FETCH_LINKEDIN_PROFILE_SAMPLE_OUTPUT,
  [GTM_SEARCH_PEOPLE_LOGIC_FUNCTION_NAME]: GTM_SEARCH_PEOPLE_SAMPLE_OUTPUT,
  [GTM_SEARCH_COMPANIES_LOGIC_FUNCTION_NAME]: GTM_SEARCH_COMPANIES_SAMPLE_OUTPUT,
  [GTM_SEARCH_JOBS_LOGIC_FUNCTION_NAME]: GTM_SEARCH_JOBS_SAMPLE_OUTPUT,
};
