import {
  GTM_FETCH_COMPANY_DETAILS_LOGIC_FUNCTION_NAME,
  GTM_FETCH_LINKEDIN_MESSAGES_LOGIC_FUNCTION_NAME,
  GTM_FETCH_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME,
  GTM_SEARCH_COMPANIES_LOGIC_FUNCTION_NAME,
  GTM_SEARCH_JOBS_LOGIC_FUNCTION_NAME,
  GTM_SEARCH_PEOPLE_FOR_COMPANY_LOGIC_FUNCTION_NAME,
  GTM_SEARCH_PEOPLE_LOGIC_FUNCTION_NAME,
} from 'src/engine/core-modules/gtm-command/constants/gtm-logic-function-names.const';

const SEARCH_PEOPLE_FOR_COMPANY_HANDLER = `// Native GTM action: SearchPeopleForCompanyService.
// Workflow/Test/executeOneLogicFunction run the server executor, not this sandbox.
export const main = async (params: {
  companyId: string;
  projectId?: string;
  limit?: number;
}) => {
  return params;
};
`;

const FETCH_LINKEDIN_PROFILE_HANDLER = `// Native GTM action: FetchLinkedinProfileService.
// Workflow/Test/executeOneLogicFunction run the server executor, not this sandbox.
export const main = async (params: {
  workspaceMemberId?: string;
  linkedinUrl?: string;
  linkedinProfileId?: string;
  candidateId?: string;
}) => {
  return params;
};
`;

const SEARCH_PEOPLE_HANDLER = `// Native GTM action: SearchPeopleService (People API, search only).
// Workflow/Test/executeOneLogicFunction run the server executor, not this sandbox.
export const main = async (params: {
  naturalLanguage?: string;
  companyName?: string;
  website?: string;
  companyId?: string;
  jobTitle?: string;
  location?: string;
  country?: string;
  dataSource?: string;
  accountId?: string;
  limit?: number;
}) => {
  return params;
};
`;

const SEARCH_COMPANIES_HANDLER = `// Native GTM action: SearchCompaniesService (Company API).
// Workflow/Test/executeOneLogicFunction run the server executor, not this sandbox.
export const main = async (params: {
  query?: string;
  keywords?: string;
  companyName?: string;
  website?: string;
  industry?: string;
  location?: string;
  dataSource?: string;
  accountId?: string;
  limit?: number;
}) => {
  return params;
};
`;

const SEARCH_JOBS_HANDLER = `// Native GTM action: SearchJobsService (Jobs API).
// Workflow/Test/executeOneLogicFunction run the server executor, not this sandbox.
export const main = async (params: {
  keywords?: string;
  location?: string;
  company?: string;
  datePosted?: number;
  dataSource?: string;
  accountId?: string;
  limit?: number;
}) => {
  return params;
};
`;

const FETCH_LINKEDIN_MESSAGES_HANDLER = `// Native GTM action: FetchLinkedinMessagesService.
// Workflow/Test/executeOneLogicFunction run the server executor, not this sandbox.
export const main = async (params: {
  workspaceMemberId?: string;
  linkedinUrl?: string;
  linkedinProfileId?: string;
  candidateId?: string;
  limit?: number;
}) => {
  return params;
};
`;

const FETCH_COMPANY_DETAILS_HANDLER = `// Native GTM action: FetchCompanyDetailsService.
// Workflow/Test/executeOneLogicFunction run the server executor, not this sandbox.
export const main = async (params: {
  companyName?: string;
  website?: string;
  linkedinUrl?: string;
  workspaceMemberId?: string;
  accountId?: string;
}) => {
  return params;
};
`;

const NATIVE_HANDLERS: Record<string, string> = {
  [GTM_SEARCH_PEOPLE_FOR_COMPANY_LOGIC_FUNCTION_NAME]:
    SEARCH_PEOPLE_FOR_COMPANY_HANDLER,
  [GTM_FETCH_LINKEDIN_PROFILE_LOGIC_FUNCTION_NAME]:
    FETCH_LINKEDIN_PROFILE_HANDLER,
  [GTM_SEARCH_PEOPLE_LOGIC_FUNCTION_NAME]: SEARCH_PEOPLE_HANDLER,
  [GTM_SEARCH_COMPANIES_LOGIC_FUNCTION_NAME]: SEARCH_COMPANIES_HANDLER,
  [GTM_SEARCH_JOBS_LOGIC_FUNCTION_NAME]: SEARCH_JOBS_HANDLER,
  [GTM_FETCH_LINKEDIN_MESSAGES_LOGIC_FUNCTION_NAME]:
    FETCH_LINKEDIN_MESSAGES_HANDLER,
  [GTM_FETCH_COMPANY_DETAILS_LOGIC_FUNCTION_NAME]:
    FETCH_COMPANY_DETAILS_HANDLER,
};

export const getGtmNativeLogicFunctionHandler = (name: string): string => {
  const handler = NATIVE_HANDLERS[name];

  if (!handler) {
    throw new Error(`No native handler source for logic function ${name}`);
  }

  return handler;
};
