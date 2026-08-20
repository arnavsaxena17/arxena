import {
  GTM_FETCH_COMPANY_DETAILS_LOGIC_FUNCTION_NAME,
  GTM_FETCH_LINKEDIN_MESSAGES_LOGIC_FUNCTION_NAME,
  GTM_FETCH_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME,
  GTM_SEARCH_COMPANIES_LOGIC_FUNCTION_NAME,
  GTM_SEARCH_JOBS_LOGIC_FUNCTION_NAME,
  GTM_SEARCH_PEOPLE_FOR_COMPANY_LOGIC_FUNCTION_NAME,
  GTM_SEARCH_PEOPLE_LOGIC_FUNCTION_NAME,
  GTM_SEARCH_POSTS_LOGIC_FUNCTION_NAME,
  GTM_UPLOAD_PROFILES_LOGIC_FUNCTION_NAME,
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
  firstName: 'Arapa',
  lastName: 'Hara',
  headline: 'Head of Sales',
  about: 'B2B sales leader at Acme',
  location: 'San Francisco',
  linkedinUrl: 'https://www.linkedin.com/in/example',
  profilePictureUrl: 'https://media.licdn.com/example.jpg',
  experience: [
    {
      company: 'Acme',
      position: 'Head of Sales',
      location: 'San Francisco',
      description: 'Owns enterprise revenue',
      start: '2022-01',
      end: '',
    },
  ],
  skills: ['Sales', 'GTM'],
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
      firstName: 'Arapa',
      lastName: 'Hara',
      title: 'Head of Sales',
      headline: 'Head of Sales at Acme',
      companyName: 'Acme',
      location: 'San Francisco',
      linkedinUrl: 'https://www.linkedin.com/in/example',
      linkedinProfileId: 'example',
      peopleId: 'ACwAAAExample',
      profilePictureUrl: '',
      source: 'index',
      stdFunction: 'sales',
      stdFunctionRoot: 'go-to-market',
      stdGrade: 'leadership',
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

export const GTM_SEARCH_POSTS_SAMPLE_OUTPUT = {
  success: true,
  total: 1,
  dataSource: 'auto',
  error: '',
  posts: [
    {
      id: 'post-1',
      socialId: 'urn:li:activity:1',
      shareUrl: 'https://www.linkedin.com/feed/update/urn:li:activity:1',
      title: 'Hiring',
      text: 'We are hiring Account Executives',
      postedAt: '2026-08-01T12:00:00.000Z',
      authorName: 'Jane Doe',
      authorUrl: 'https://www.linkedin.com/in/jane-doe',
      reactionCount: 12,
      commentCount: 3,
      isRepost: false,
    },
  ],
};

export const GTM_FETCH_LINKEDIN_MESSAGES_SAMPLE_OUTPUT = {
  success: true,
  chatId: 'chat-1',
  attendeeId: 'ACoAAExampleProviderId1234567890',
  total: 1,
  error: '',
  messages: [
    {
      id: 'msg-1',
      text: 'Hello',
      timestamp: '2026-08-01T00:00:00.000Z',
      senderId: 'ACoAAExampleProviderId1234567890',
      isSender: false,
    },
  ],
};

export const GTM_FETCH_COMPANY_DETAILS_SAMPLE_OUTPUT = {
  success: true,
  dataSource: 'unipile',
  error: '',
  company: {
    id: '123',
    name: 'Acme',
    website: 'acme.com',
    linkedinUrl: 'https://www.linkedin.com/company/acme',
    industry: 'Software',
    description: 'B2B software',
    tagline: 'Build faster',
    employeeCount: 200,
    followersCount: 1000,
    publicIdentifier: 'acme',
  },
};

export const GTM_UPLOAD_PROFILES_SAMPLE_OUTPUT = {
  success: true,
  queued: 1,
  projectId: 'project-id',
  error: '',
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
  [GTM_SEARCH_POSTS_LOGIC_FUNCTION_NAME]: GTM_SEARCH_POSTS_SAMPLE_OUTPUT,
  [GTM_FETCH_LINKEDIN_MESSAGES_LOGIC_FUNCTION_NAME]:
    GTM_FETCH_LINKEDIN_MESSAGES_SAMPLE_OUTPUT,
  [GTM_FETCH_COMPANY_DETAILS_LOGIC_FUNCTION_NAME]:
    GTM_FETCH_COMPANY_DETAILS_SAMPLE_OUTPUT,
  [GTM_UPLOAD_PROFILES_LOGIC_FUNCTION_NAME]: GTM_UPLOAD_PROFILES_SAMPLE_OUTPUT,
};
