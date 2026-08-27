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
  GTM_UPSERT_COMPANIES_LOGIC_FUNCTION_NAME,
  GTM_ENRICH_CONTACT_LOGIC_FUNCTION_NAME,
  GTM_GET_CALENDAR_AVAILABILITY_LOGIC_FUNCTION_NAME,
  GTM_DETECT_FAKE_PROFILES_LOGIC_FUNCTION_NAME,
  GTM_FILTER_PROFILES_LOGIC_FUNCTION_NAME,
} from 'src/engine/core-modules/gtm-command/constants/gtm-logic-function-names.const';

const SEARCH_PEOPLE_FOR_COMPANY_HANDLER = `// Native GTM action: SearchPeopleForCompanyService.
// Workflow/Test/executeOneLogicFunction run the server executor, not this sandbox.
export const main = async (params: {
  companyId: string;
  projectId?: string;
  jobTitle?: string;
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
  searchUrl?: string;
  companyName?: string;
  website?: string;
  companyId?: string;
  jobTitle?: string;
  locations?: string[];
  country?: string;
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
  url?: string;
  projectId?: string;
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

const SEARCH_POSTS_HANDLER = `// Native GTM action: SearchPostsService (Posts API).
// Workflow/Test/executeOneLogicFunction run the server executor, not this sandbox.
export const main = async (params: {
  keywords?: string;
  sortBy?: string;
  datePosted?: string;
  contentType?: string;
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

const UPLOAD_PROFILES_HANDLER = `// Native GTM action: UploadProfilesService.
// Workflow/Test/executeOneLogicFunction run the server executor, not this sandbox.
export const main = async (params: {
  projectId: string;
  companyId?: string;
  people?: Array<Record<string, unknown>>;
  candidates?: Array<Record<string, unknown>>;
  candidateId?: string;
  linkedinUrl?: string;
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

const UPSERT_COMPANIES_HANDLER = `// Native GTM action: UpsertCompaniesService.
// Workflow/Test/executeOneLogicFunction run the server executor, not this sandbox.
export const main = async (params: {
  projectId: string;
  companies?: Array<Record<string, unknown>>;
  limit?: number;
}) => {
  return params;
};
`;

const ENRICH_CONTACT_HANDLER = `// Native GTM action: EnrichContactService.
// Workflow/Test/executeOneLogicFunction run the server executor, not this sandbox.
export const main = async (params: {
  candidateId?: string;
  linkedinUrl?: string;
  wantEmail?: boolean;
  wantPhone?: boolean;
}) => {
  return params;
};
`;

const GET_CALENDAR_AVAILABILITY_HANDLER = `// Native GTM action: GetCalendarAvailabilityService.
// Workflow/Test/executeOneLogicFunction run the server executor, not this sandbox.
export const main = async (params: {
  workspaceMemberId?: string;
  days?: number;
  slotMinutes?: number;
}) => {
  return params;
};
`;

const DETECT_FAKE_PROFILES_HANDLER = `// Native GTM action: GtmFakeProfileDetectorService.
// Workflow/Test/executeOneLogicFunction run the server executor, not this sandbox.
export const main = async (params: {
  profile?: Record<string, unknown>;
  snapshot?: Record<string, unknown>;
  profiles?: Array<Record<string, unknown>>;
  modelId?: string;
}) => {
  return params;
};
`;

const FILTER_PROFILES_HANDLER = `// Native GTM action: GtmFilterProfilesService.
// Workflow/Test/executeOneLogicFunction run the server executor, not this sandbox.
export const main = async (params: {
  profiles?: Array<Record<string, unknown>>;
  prompt?: string;
  modelId?: string;
  onlyOnePersonPerCompany?: boolean;
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
  [GTM_SEARCH_POSTS_LOGIC_FUNCTION_NAME]: SEARCH_POSTS_HANDLER,
  [GTM_FETCH_LINKEDIN_MESSAGES_LOGIC_FUNCTION_NAME]:
    FETCH_LINKEDIN_MESSAGES_HANDLER,
  [GTM_FETCH_COMPANY_DETAILS_LOGIC_FUNCTION_NAME]:
    FETCH_COMPANY_DETAILS_HANDLER,
  [GTM_UPLOAD_PROFILES_LOGIC_FUNCTION_NAME]: UPLOAD_PROFILES_HANDLER,
  [GTM_UPSERT_COMPANIES_LOGIC_FUNCTION_NAME]: UPSERT_COMPANIES_HANDLER,
  [GTM_ENRICH_CONTACT_LOGIC_FUNCTION_NAME]: ENRICH_CONTACT_HANDLER,
  [GTM_GET_CALENDAR_AVAILABILITY_LOGIC_FUNCTION_NAME]:
    GET_CALENDAR_AVAILABILITY_HANDLER,
  [GTM_DETECT_FAKE_PROFILES_LOGIC_FUNCTION_NAME]: DETECT_FAKE_PROFILES_HANDLER,
  [GTM_FILTER_PROFILES_LOGIC_FUNCTION_NAME]: FILTER_PROFILES_HANDLER,
};

export const getGtmNativeLogicFunctionHandler = (name: string): string => {
  const handler = NATIVE_HANDLERS[name];

  if (!handler) {
    throw new Error(`No native handler source for logic function ${name}`);
  }

  return handler;
};
