/**
 * MCP tool input schema descriptors and input/output types.
 * Used by twenty-mcp-server to build inputSchema from a single source of truth
 * and to type tool handlers.
 */

export type McpInputFieldType = 'string' | 'number' | 'boolean' | 'object';

export type McpInputFieldDescriptor = {
  key: string;
  type: McpInputFieldType;
  description: string;
  required: boolean;
};

/** Descriptor for find_person tool input. */
export const FIND_PERSON_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'name', type: 'string', description: 'Partial or full name to search for', required: false },
  { key: 'email', type: 'string', description: 'Email address (exact match)', required: false },
  { key: 'phone', type: 'string', description: 'Phone number (partial match)', required: false },
  { key: 'limit', type: 'number', description: 'Maximum results (default: 20)', required: false },
] as const;

export type FindPersonInput = {
  name?: string;
  email?: string;
  phone?: string;
  limit?: number;
};

export type FindPersonCandidateSummary = {
  candidateId: string;
  candidateName?: string;
  status?: string;
  jobId?: string;
  jobName?: string;
};

// export type FindPersonResultItem = {
//   personId: string;
//   firstName?: string;
//   lastName?: string;
//   phone?: string;
//   email?: string;
//   city?: string;
//   jobTitle?: string;
//   salary?: string;
//   linkedinUrl?: string;
//   candidates: FindPersonCandidateSummary[];
// };

// export type FindPersonResult = {
//   count: number;
//   people: FindPersonResultItem[];
// };

/** Descriptor for update_contact_info tool input. */
export const UPDATE_CONTACT_INFO_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'personId', type: 'string', description: 'The person ID to update', required: true },
  { key: 'phoneNumber', type: 'string', description: 'New phone number with country code (e.g. "+919876543210")', required: false },
  { key: 'email', type: 'string', description: 'New email address', required: false },
  { key: 'city', type: 'string', description: 'New city', required: false },
  { key: 'firstName', type: 'string', description: 'Updated first name', required: false },
  { key: 'lastName', type: 'string', description: 'Updated last name', required: false },
  { key: 'jobTitle', type: 'string', description: 'Updated job title', required: false },
  { key: 'salary', type: 'string', description: 'Updated salary (as a string)', required: false },
] as const;

export type UpdatedPersonSchema = {
  city: 'string',
  name: {
    firstName: 'string',
    lastName: 'string',
  },
  id: 'string',
  emails: {
    primaryEmail: 'string',
  },
  phones: {
    primaryPhoneNumber: 'string',
  },
} ;
export type UpdateContactInfoInput = {
  personId: string;
  phoneNumber?: string;
  email?: string;
  city?: string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  salary?: string;
};

export type UpdateContactInfoResult = {
  success: boolean;
  updatedPerson: unknown;
  message: string;
};

/** Descriptor for get_candidate_fields_for_job tool input. */
export const GET_CANDIDATE_FIELDS_FOR_JOB_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'jobId', type: 'string', description: 'The job ID to get candidate fields for', required: true },
] as const;

export type GetCandidateFieldsForJobInput = {
  jobId: string;
};

/** Descriptor for get_candidate_field_values tool input. */
export const GET_CANDIDATE_FIELD_VALUES_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'candidateId', type: 'string', description: 'The candidate ID to get field values for', required: true },
] as const;

export type GetCandidateFieldValuesInput = {
  candidateId: string;
};

export type CandidateFieldValueResultItem = {
  id: string;
  value?: string;
  fieldName?: string;
  fieldLabel?: string;
};

export type GetCandidateFieldValuesResult = {
  count: number;
  fieldValues: CandidateFieldValueResultItem[];
};

/** Descriptor for enrich_contact_from_data tool input. */
export const ENRICH_CONTACT_FROM_DATA_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  {
    key: 'contactData',
    type: 'object',
    description: 'The enrichment data object. Should contain contact details, work history, etc.',
    required: true,
  },
] as const;

export type EnrichContactFromDataInput = {
  contactData: Record<string, unknown>;
};

/** Descriptor for upload_profiles tool input. */
export const UPLOAD_PROFILES_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'jobId', type: 'string', description: 'Job ID to attach candidates to', required: true },
  { key: 'jobName', type: 'string', description: 'Job name', required: true },
  { key: 'data_source', type: 'string', description: 'Source e.g. profile_data_naukri, linkedin_search, linkedin_premium', required: false },
  { key: 'candidates', type: 'object', description: 'Array of candidate profile objects', required: false },
  { key: 'recruiterId', type: 'string', description: 'Recruiter workspace member ID', required: false },
  { key: 'json_data', type: 'object', description: 'Alternative: raw JSON data with users/candidates', required: false },
] as const;

/** Descriptor for post_candidates tool input. */
export const POST_CANDIDATES_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'job_id', type: 'string', description: 'Job ID', required: true },
  { key: 'job_name', type: 'string', description: 'Job name', required: true },
  { key: 'data', type: 'object', description: 'Array of candidate profile objects (UserProfile shape)', required: true },
  { key: 'data_source', type: 'string', description: 'Source identifier', required: false },
  { key: 'recruiterId', type: 'string', description: 'Recruiter workspace member ID', required: false },
  { key: 'timestamp', type: 'string', description: 'ISO timestamp', required: false },
] as const;

/** Descriptor for process_filter_description tool input. */
export const PROCESS_FILTER_DESCRIPTION_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'filterDescription', type: 'string', description: 'Natural language filter (e.g. salary > 40L)', required: true },
  { key: 'candidateFields', type: 'object', description: 'Available candidate fields for validation', required: false },
] as const;

/** Descriptor for process_ai_filters tool input. */
export const PROCESS_AI_FILTERS_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'jobId', type: 'string', description: 'Job ID', required: true },
  { key: 'aiFilters', type: 'object', description: 'Array of AI filter configs', required: false },
  { key: 'enrichments', type: 'object', description: 'Alternative to aiFilters', required: false },
  { key: 'selectedRecordIds', type: 'object', description: 'Candidate/record IDs to apply filters to', required: false },
  { key: 'objectNameSingular', type: 'string', description: 'Object name', required: false },
] as const;

/** Descriptor for parse_job_description tool input. */
export const PARSE_JOB_DESCRIPTION_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'jobDescription', type: 'string', description: 'Raw job description text', required: false },
  { key: 'filePath', type: 'string', description: 'Path to JD file', required: false },
] as const;

/** Descriptor for resolve_parameters tool input (candidate-search). */
export const RESOLVE_PARAMETERS_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'searchParameters', type: 'object', description: 'Search parameters object', required: true },
  { key: 'searchType', type: 'string', description: 'One of: classic, sales_navigator, recruiter', required: true },
  { key: 'searchCategory', type: 'string', description: 'One of: people, companies, posts, jobs', required: true },
] as const;

/** Descriptor for send_chat tool input. */
export const SEND_CHAT_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'candidateId', type: 'string', description: 'Candidate ID to send message to', required: true },
  { key: 'message', type: 'string', description: 'Message content', required: true },
  { key: 'phoneNumber', type: 'string', description: 'Optional phone number override', required: false },
] as const;

/** Descriptor for share_jd_to_candidate tool input. */
export const SHARE_JD_TO_CANDIDATE_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'candidateId', type: 'string', description: 'Candidate ID', required: true },
  { key: 'jobId', type: 'string', description: 'Job ID', required: true },
  { key: 'jdContent', type: 'string', description: 'JD text or reference', required: false },
] as const;

// ==================== Arx Chat Tools ====================

/** Descriptor for get_all_messages_by_candidate_id tool input. */
export const GET_ALL_MESSAGES_BY_CANDIDATE_ID_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'candidateId', type: 'string', description: 'Candidate ID', required: true },
] as const;

/** Descriptor for upload_jd tool input. */
export const UPLOAD_JD_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'jobId', type: 'string', description: 'Job ID', required: true },
  { key: 'filePath', type: 'string', description: 'Path or reference to JD file', required: false },
  { key: 'content', type: 'string', description: 'Optional raw JD content', required: false },
] as const;

/** Descriptor for get_candidates_by_job_id tool input. */
export const GET_CANDIDATES_BY_JOB_ID_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'jobId', type: 'string', description: 'Job ID', required: true },
] as const;

/** Descriptor for send_bulk_chats_by_candidate_ids tool input. */
export const SEND_BULK_CHATS_BY_CANDIDATE_IDS_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'candidateIds', type: 'object', description: 'List of candidate IDs', required: true },
  { key: 'message', type: 'string', description: 'Message content', required: true },
] as const;

// ==================== Candidate Search Tools ====================

/** Descriptor for generate_search_parameters tool input. */
export const GENERATE_SEARCH_PARAMETERS_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'parsedJobDescription', type: 'object', description: 'Output from parse_job_description, Default is null.', required: false },
  { key: 'searchType', type: 'string', description: 'One of: classic, sales_navigator, recruiter. Default is classic.', required: true },
  { key: 'prompt', type: 'string', description: 'Prompt for generating search parameters', required: true },
  { key: 'searchCategory', type: 'string', description: 'One of: people, companies, posts, jobs. Default is people.', required: true },
  { key: 'searchFilterId', type: 'string', description: 'Search filter ID. Default is null.', required: false },
] as const;

// ==================== Org Chart Tools ====================

/** Descriptor for get_org_chart tool input. */
export const GET_ORG_CHART_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'companyId', type: 'string', description: 'The company ID to fetch org chart for (optional if companyName provided)', required: false },
  { key: 'companyName', type: 'string', description: 'Company name to search for (required if companyId not provided)', required: false },
  { key: 'country', type: 'string', description: 'Filter org chart by country (e.g., "India", "United States")', required: false },
  { key: 'functionRoot', type: 'string', description: 'Filter org chart by function/department (e.g., "Engineering", "Sales")', required: false },
] as const;

/** Descriptor for search_org_charts_by_country tool input. */
export const SEARCH_ORG_CHARTS_BY_COUNTRY_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'companyId', type: 'string', description: 'The company ID to search org charts for (optional if companyName provided)', required: false },
  { key: 'companyName', type: 'string', description: 'Company name to search for (required if companyId not provided)', required: false },
  { key: 'country', type: 'string', description: 'Country to filter by (e.g., "India", "United States")', required: true },
  { key: 'limit', type: 'number', description: 'Maximum number of results to return (default: 10)', required: false },
] as const;

/** Descriptor for search_org_charts_by_function tool input. */
export const SEARCH_ORG_CHARTS_BY_FUNCTION_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'companyId', type: 'string', description: 'The company ID to search org charts for (optional if companyName provided)', required: false },
  { key: 'companyName', type: 'string', description: 'Company name to search for (required if companyId not provided)', required: false },
  { key: 'functionRoot', type: 'string', description: 'Function/department to filter by (e.g., "Engineering", "Sales", "Marketing")', required: true },
  { key: 'limit', type: 'number', description: 'Maximum number of results to return (default: 10)', required: false },
] as const;

// ==================== LinkedIn Search Tools ====================

/** Descriptor for expand_companies tool input. */
export const EXPAND_COMPANIES_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'parsedRequirement', type: 'object', description: 'Parsed requirement object containing role, industry, location, company_type, etc.', required: true },
] as const;

/** Descriptor for expand_job_titles tool input. */
export const EXPAND_JOB_TITLES_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'parsedRequirement', type: 'object', description: 'Parsed requirement object containing role, industry, location, etc.', required: true },
] as const;

/** Descriptor for search_linkedin_people tool input. */
export const SEARCH_LINKEDIN_PEOPLE_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'searchType', type: 'string', description: 'One of: classic, sales_navigator, recruiter', required: true },
  { key: 'searchParameters', type: 'object', description: 'LinkedIn search parameters object (optional if query provided)', required: false },
  { key: 'query', type: 'string', description: 'Natural language query for full search flow (optional if searchParameters provided)', required: false },
  { key: 'searchFilterId', type: 'string', description: 'Search filter ID (required if using query)', required: false },
  { key: 'parsedJD', type: 'object', description: 'Parsed job description (optional, used with query)', required: false },
  { key: 'cursor', type: 'string', description: 'Pagination cursor for continuing search', required: false },
  { key: 'limit', type: 'number', description: 'Maximum number of results to return', required: false },
] as const;


/** Descriptor for search_linkedin_with_query tool input. */
export const SEARCH_LINKEDIN_WITH_QUERY_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'query', type: 'string', description: 'Natural language search query', required: true },
  { key: 'searchType', type: 'string', description: 'One of: classic, sales_navigator, recruiter', required: true },
  { key: 'searchCategory', type: 'string', description: 'One of: people, companies, posts, jobs', required: true },
  { key: 'searchFilterId', type: 'string', description: 'Search filter ID', required: true },
  { key: 'parsedJD', type: 'object', description: 'Parsed job description (optional)', required: false },
  { key: 'includeJd', type: 'boolean', description: 'Whether to include JD in search context', required: false },
] as const;


/** Descriptor for search_linkedin_companies tool input. */
export const SEARCH_LINKEDIN_COMPANIES_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'searchType', type: 'string', description: 'One of: classic, sales_navigator', required: true },
  { key: 'searchParameters', type: 'object', description: 'LinkedIn search parameters object', required: true },
  { key: 'cursor', type: 'string', description: 'Pagination cursor for continuing search', required: false },
  { key: 'limit', type: 'number', description: 'Maximum number of results to return', required: false },
] as const;

/** Descriptor for search_linkedin_jobs tool input. */
export const SEARCH_LINKEDIN_JOBS_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'searchParameters', type: 'object', description: 'LinkedIn search parameters object', required: true },
  { key: 'cursor', type: 'string', description: 'Pagination cursor for continuing search', required: false },
  { key: 'limit', type: 'number', description: 'Maximum number of results to return', required: false },
] as const;

/** Descriptor for search_linkedin_parameters tool input. */
export const SEARCH_LINKEDIN_PARAMETERS_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'parameterType', type: 'string', description: 'Type of parameter to fetch: locations, industries, companies, schools, job-titles, skills, saved-searches, recent-searches', required: true },
  { key: 'keywords', type: 'string', description: 'Keywords to filter parameters', required: true },
  { key: 'limit', type: 'number', description: 'Maximum number of parameters to return', required: false },
] as const;



/** Descriptor for generate_linkedin_query_set tool input. */
export const GENERATE_LINKEDIN_QUERY_SET_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'rawRequirement', type: 'string', description: 'Raw natural language search requirement', required: true },
  { key: 'queryIpLocation', type: 'string', description: 'Optional IP location for context', required: false },
  { key: 'model', type: 'string', description: 'Optional LLM model to use', required: false },
  { key: 'temperature', type: 'number', description: 'Optional temperature for LLM', required: false },
  { key: 'verbose', type: 'boolean', description: 'Whether to include verbose output', required: false },
] as const;

/** Descriptor for generate_linkedin_query_agent1 tool input. */
export const GENERATE_LINKEDIN_QUERY_AGENT1_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'rawRequirement', type: 'string', description: 'Raw natural language search requirement', required: true },
  { key: 'queryIpLocation', type: 'string', description: 'Optional IP location for context', required: false },
  { key: 'model', type: 'string', description: 'Optional LLM model to use', required: false },
  { key: 'temperature', type: 'number', description: 'Optional temperature for LLM', required: false },
] as const;

/** Descriptor for generate_linkedin_query_agent2 tool input. */
export const GENERATE_LINKEDIN_QUERY_AGENT2_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'parsedRequirement', type: 'object', description: 'Parsed requirement from Agent 1', required: true },
  { key: 'model', type: 'string', description: 'Optional LLM model to use', required: false },
  { key: 'temperature', type: 'number', description: 'Optional temperature for LLM', required: false },
] as const;

/** Descriptor for generate_linkedin_query_agent3 tool input. */
export const GENERATE_LINKEDIN_QUERY_AGENT3_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'parsedRequirement', type: 'object', description: 'Parsed requirement from Agent 1', required: true },
  { key: 'masterLists', type: 'object', description: 'Master lists from Agent 2', required: true },
  { key: 'model', type: 'string', description: 'Optional LLM model to use', required: false },
  { key: 'temperature', type: 'number', description: 'Optional temperature for LLM', required: false },
] as const;

/** Descriptor for generate_linkedin_query_agent4 tool input. */
export const GENERATE_LINKEDIN_QUERY_AGENT4_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'parsedRequirement', type: 'object', description: 'Parsed requirement from Agent 1', required: true },
  { key: 'primaryQuery', type: 'object', description: 'Primary query from Agent 3', required: true },
  { key: 'model', type: 'string', description: 'Optional LLM model to use', required: false },
  { key: 'temperature', type: 'number', description: 'Optional temperature for LLM', required: false },
] as const;

/** Descriptor for generate_linkedin_query_batch tool input. */
export const GENERATE_LINKEDIN_QUERY_BATCH_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'requirements', type: 'object', description: 'Array of raw natural language requirements', required: true },
  { key: 'parallel', type: 'boolean', description: 'Whether to process requirements in parallel', required: false },
  { key: 'verbose', type: 'boolean', description: 'Whether to include verbose output', required: false },
  { key: 'queryIpLocation', type: 'string', description: 'Optional IP location for context', required: false },
  { key: 'model', type: 'string', description: 'Optional LLM model to use', required: false },
  { key: 'temperature', type: 'number', description: 'Optional temperature for LLM', required: false },
] as const;

/** Descriptor for validate_linkedin_query_set tool input. */
export const VALIDATE_LINKEDIN_QUERY_SET_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'querySet', type: 'object', description: 'Query set to validate', required: true },
] as const;

/** Descriptor for check_contact_availability tool input. */
export const CHECK_CONTACT_AVAILABILITY_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'linkedinUrl', type: 'string', description: 'Single LinkedIn profile URL', required: false },
  { key: 'linkedinUrls', type: 'object', description: 'Array of LinkedIn profile URLs', required: false },
] as const;

/** Descriptor for check_contact_availability_from_arxena tool input. */
export const CHECK_CONTACT_AVAILABILITY_FROM_ARXENA_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'linkedinUrl', type: 'string', description: 'Single LinkedIn profile URL', required: false },
  { key: 'linkedinUrls', type: 'object', description: 'Array of LinkedIn profile URLs', required: false },
] as const;

/** Descriptor for check_contact_availability_from_pdl tool input. */
export const CHECK_CONTACT_AVAILABILITY_FROM_PDL_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'linkedinUrl', type: 'string', description: 'Single LinkedIn profile URL', required: false },
  { key: 'linkedinUrls', type: 'object', description: 'Array of LinkedIn profile URLs', required: false },
] as const;

/** Descriptor for check_contact_availability_from_contactout tool input. */
export const CHECK_CONTACT_AVAILABILITY_FROM_CONTACTOUT_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'linkedinUrl', type: 'string', description: 'Single LinkedIn profile URL', required: false },
  { key: 'linkedinUrls', type: 'object', description: 'Array of LinkedIn profile URLs', required: false },
] as const;

/** Descriptor for check_contact_availability_from_lusha tool input. */
export const CHECK_CONTACT_AVAILABILITY_FROM_LUSHA_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'linkedinUrl', type: 'string', description: 'Single LinkedIn profile URL', required: false },
  { key: 'linkedinUrls', type: 'object', description: 'Array of LinkedIn profile URLs', required: false },
] as const;

/** Descriptor for check_contact_availability_from_apollo tool input. */
export const CHECK_CONTACT_AVAILABILITY_FROM_APOLLO_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'linkedinUrl', type: 'string', description: 'Single LinkedIn profile URL', required: false },
  { key: 'linkedinUrls', type: 'object', description: 'Array of LinkedIn profile URLs', required: false },
] as const;

/** Descriptor for fetch_contacts tool input. */
export const FETCH_CONTACTS_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'linkedinUrl', type: 'string', description: 'Single LinkedIn profile URL', required: false },
  { key: 'linkedinUrls', type: 'object', description: 'Array of LinkedIn profile URLs', required: false },
  { key: 'wantEmail', type: 'boolean', description: 'Whether to fetch email addresses', required: false },
  { key: 'wantPhone', type: 'boolean', description: 'Whether to fetch phone numbers', required: false },
] as const;

/** Descriptor for fetch_contacts_from_arxena tool input. */
export const FETCH_CONTACTS_FROM_ARXENA_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'linkedinUrl', type: 'string', description: 'Single LinkedIn profile URL', required: false },
  { key: 'linkedinUrls', type: 'object', description: 'Array of LinkedIn profile URLs', required: false },
  { key: 'wantEmail', type: 'boolean', description: 'Whether to fetch email addresses', required: false },
  { key: 'wantPhone', type: 'boolean', description: 'Whether to fetch phone numbers', required: false },
] as const;

/** Descriptor for fetch_contacts_from_pdl tool input. */
export const FETCH_CONTACTS_FROM_PDL_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'linkedinUrl', type: 'string', description: 'Single LinkedIn profile URL', required: false },
  { key: 'linkedinUrls', type: 'object', description: 'Array of LinkedIn profile URLs', required: false },
  { key: 'wantEmail', type: 'boolean', description: 'Whether to fetch email addresses', required: false },
  { key: 'wantPhone', type: 'boolean', description: 'Whether to fetch phone numbers', required: false },
] as const;

/** Descriptor for fetch_contacts_from_contactout tool input. */
export const FETCH_CONTACTS_FROM_CONTACTOUT_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'linkedinUrl', type: 'string', description: 'Single LinkedIn profile URL', required: false },
  { key: 'linkedinUrls', type: 'object', description: 'Array of LinkedIn profile URLs', required: false },
  { key: 'wantEmail', type: 'boolean', description: 'Whether to fetch email addresses', required: false },
  { key: 'wantPhone', type: 'boolean', description: 'Whether to fetch phone numbers', required: false },
] as const;

/** Descriptor for fetch_contacts_from_lusha tool input. */
export const FETCH_CONTACTS_FROM_LUSHA_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'linkedinUrl', type: 'string', description: 'Single LinkedIn profile URL', required: false },
  { key: 'linkedinUrls', type: 'object', description: 'Array of LinkedIn profile URLs', required: false },
  { key: 'wantEmail', type: 'boolean', description: 'Whether to fetch email addresses', required: false },
  { key: 'wantPhone', type: 'boolean', description: 'Whether to fetch phone numbers', required: false },
] as const;

/** Descriptor for fetch_contacts_from_apollo tool input. */
export const FETCH_CONTACTS_FROM_APOLLO_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'linkedinUrl', type: 'string', description: 'Single LinkedIn profile URL', required: false },
  { key: 'linkedinUrls', type: 'object', description: 'Array of LinkedIn profile URLs', required: false },
  { key: 'wantEmail', type: 'boolean', description: 'Whether to fetch email addresses', required: false },
  { key: 'wantPhone', type: 'boolean', description: 'Whether to fetch phone numbers', required: false },
] as const;

/** Descriptor for get_contact_enrichment_job tool input. */
export const GET_CONTACT_ENRICHMENT_JOB_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'jobId', type: 'string', description: 'Job ID returned from bulk enrichment operations', required: true },
] as const;

// ==================== Extension Bridge Tools ====================

/** Descriptor for resdex_download_cv tool input. */
export const RESDEX_DOWNLOAD_CV_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'contact_obj', type: 'object', description: 'Contact object with candidate information', required: true },
  { key: 'url', type: 'string', description: 'Resdex candidate profile URL', required: true },
  { key: 'useDirectDownload', type: 'boolean', description: 'Whether to use direct download method', required: false },
  { key: 'fileName', type: 'string', description: 'Optional filename for the downloaded CV', required: false },
] as const;

/** Descriptor for resdex_open_tabs tool input. */
export const RESDEX_OPEN_TABS_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'urls', type: 'object', description: 'Array of Resdex candidate profile URLs to open', required: true },
  { key: 'current_table_id', type: 'string', description: 'Optional table ID for tracking', required: false },
] as const;

/** Descriptor for resdex_fetch_and_send_profiles tool input. */
export const RESDEX_FETCH_AND_SEND_PROFILES_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'current_table_id', type: 'string', description: 'Optional table ID for tracking', required: false },
] as const;

/** Descriptor for resdex_crawl tool input. */
export const RESDEX_CRAWL_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'current_table_id', type: 'string', description: 'Optional table ID for tracking', required: false },
  { key: 'maxPages', type: 'number', description: 'Maximum number of pages to crawl', required: false },
] as const;

/** Descriptor for hiring_naukri_crawl tool input. */
export const HIRING_NAUKRI_CRAWL_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'current_table_id', type: 'string', description: 'Optional table ID for tracking', required: false },
  { key: 'maxPages', type: 'number', description: 'Maximum number of pages to crawl', required: false },
] as const;

/** Descriptor for hiring_naukri_fetch_and_send_profiles tool input. */
export const HIRING_NAUKRI_FETCH_AND_SEND_PROFILES_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'current_table_id', type: 'string', description: 'Optional table ID for tracking', required: false },
] as const;

/** Descriptor for rms_naukri_crawl tool input. */
export const RMS_NAUKRI_CRAWL_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'current_table_id', type: 'string', description: 'Optional table ID for tracking', required: false },
  { key: 'maxPages', type: 'number', description: 'Maximum number of pages to crawl', required: false },
] as const;

/** Descriptor for rms_naukri_fetch_and_send_profiles tool input. */
export const RMS_NAUKRI_FETCH_AND_SEND_PROFILES_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'current_table_id', type: 'string', description: 'Optional table ID for tracking', required: false },
] as const;

/** Descriptor for naukri_update_contact tool input. */
export const NAUKRI_UPDATE_CONTACT_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'contact_id', type: 'string', description: 'Contact ID in Arxena to update', required: true },
  { key: 'candidate_url', type: 'string', description: 'Naukri candidate profile URL', required: false },
] as const;

/** Descriptor for naukri_upload_profiles tool input. */
export const NAUKRI_UPLOAD_PROFILES_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'profiles', type: 'object', description: 'Array of profile objects to upload', required: true },
] as const;

/** Descriptor for linkedin_send_message tool input. */
export const LINKEDIN_SEND_MESSAGE_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'message', type: 'string', description: 'Message content to send', required: true },
  { key: 'name', type: 'string', description: 'Name of the contact', required: true },
  { key: 'linkedin_url', type: 'string', description: 'LinkedIn profile URL of the contact', required: true },
] as const;

/** Descriptor for linkedin_send_connection_request tool input. */
export const LINKEDIN_SEND_CONNECTION_REQUEST_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'message', type: 'string', description: 'Optional connection request message', required: false },
  { key: 'name', type: 'string', description: 'Name of the contact', required: true },
  { key: 'linkedin_url', type: 'string', description: 'LinkedIn profile URL of the contact', required: true },
] as const;

/** Descriptor for linkedin_get_unread_messages tool input. */
export const LINKEDIN_GET_UNREAD_MESSAGES_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [] as const;

/** Descriptor for linkedin_fetch_cookies tool input. */
export const LINKEDIN_FETCH_COOKIES_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [] as const;

/** Descriptor for whatsapp_send_message tool input. */
export const WHATSAPP_SEND_MESSAGE_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'phoneNumber', type: 'string', description: 'Phone number to send message to (format: country code + number, e.g., "+1234567890")', required: true },
  { key: 'message', type: 'string', description: 'Message content to send', required: true },
  { key: 'twentyMessageId', type: 'string', description: 'Optional message ID from Arxena for tracking', required: false },
] as const;

/** Descriptor for whatsapp_send_attachment tool input. */
export const WHATSAPP_SEND_ATTACHMENT_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'phoneNumber', type: 'string', description: 'Phone number to send attachment to', required: true },
  { key: 'attachments', type: 'object', description: 'Array of attachment objects', required: true },
  { key: 'caption', type: 'string', description: 'Optional caption for the attachment', required: false },
] as const;

// ==================== Candidate Tools ====================

/** Descriptor for list_candidates_for_job tool input. */
export const LIST_CANDIDATES_FOR_JOB_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'jobId', type: 'string', description: 'The job ID to list candidates for', required: true },
  { key: 'status', type: 'string', description: 'Optional status filter (e.g. SCREENING, INTERESTED, NOT_INTERESTED, NOT_FIT, CV_SENT, CV_RECEIVED, RECRUITER_INTERVIEW, CLIENT_INTERVIEW, NEGOTIATION)', required: false },
  { key: 'limit', type: 'number', description: 'Maximum number of candidates to return (default: 50)', required: false },
] as const;

/** Descriptor for find_candidate tool input. */
export const FIND_CANDIDATE_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'name', type: 'string', description: 'Partial or full name to search for', required: false },
  { key: 'email', type: 'string', description: 'Email address to search for (exact match)', required: false },
  { key: 'phone', type: 'string', description: 'Phone number to search for (partial match)', required: false },
  { key: 'limit', type: 'number', description: 'Maximum results (default: 20)', required: false },
] as const;

/** Descriptor for get_candidate_details tool input. */
export const GET_CANDIDATE_DETAILS_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'candidateId', type: 'string', description: 'The candidate ID to fetch details for', required: true },
] as const;

/** Descriptor for create_candidate tool input. */
export const CREATE_CANDIDATE_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'jobId', type: 'string', description: 'The job ID to link this candidate to', required: true },
  { key: 'name', type: 'string', description: 'Full name of the candidate (e.g. "John Smith")', required: true },
  { key: 'phoneNumber', type: 'string', description: 'Phone number with country code (e.g. "+919876543210")', required: false },
  { key: 'email', type: 'string', description: 'Email address', required: false },
  { key: 'status', type: 'string', description: 'Initial status (default: SCREENING). Options: SCREENING, INTERESTED, NOT_INTERESTED, NOT_FIT, CV_SENT, CV_RECEIVED, RECRUITER_INTERVIEW, CLIENT_INTERVIEW, NEGOTIATION', required: false },
  { key: 'source', type: 'string', description: 'Source of the candidate (e.g. "LinkedIn", "Referral", "Portal")', required: false },
  { key: 'remarks', type: 'string', description: 'Initial notes about the candidate', required: false },
] as const;

/** Descriptor for update_candidate_status tool input. */
export const UPDATE_CANDIDATE_STATUS_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'candidateId', type: 'string', description: 'The candidate ID to update', required: true },
  { key: 'status', type: 'string', description: 'New status value. One of: SCREENING, INTERESTED, NOT_INTERESTED, NOT_FIT, CV_SENT, CV_RECEIVED, RECRUITER_INTERVIEW, CLIENT_INTERVIEW, NEGOTIATION', required: true },
] as const;

/** Descriptor for update_candidate_phone tool input. */
export const UPDATE_CANDIDATE_PHONE_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'candidateId', type: 'string', description: 'The candidate ID whose phone number to update', required: true },
  { key: 'phoneNumber', type: 'string', description: 'New phone number with country code (e.g. "+919876543210")', required: true },
  { key: 'countryCode', type: 'string', description: 'Country code (default: "+91")', required: false },
] as const;

/** Descriptor for update_candidate_salary tool input. */
export const UPDATE_CANDIDATE_SALARY_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'candidateId', type: 'string', description: 'The candidate ID to update', required: true },
  { key: 'fieldName', type: 'string', description: 'The custom field name (e.g. "currentSalary", "expectedSalary", "ctc")', required: true },
  { key: 'value', type: 'string', description: 'The new value for the field', required: true },
] as const;

/** Descriptor for update_candidate_remarks tool input. */
export const UPDATE_CANDIDATE_REMARKS_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'candidateId', type: 'string', description: 'The candidate ID to update', required: true },
  { key: 'remarks', type: 'string', description: 'New remarks or notes for the candidate', required: true },
] as const;

/** Descriptor for refresh_table_data tool input. */
export const REFRESH_TABLE_DATA_INPUT_DESCRIPTOR: readonly McpInputFieldDescriptor[] = [
  { key: 'recruiterId', type: 'string', description: 'Recruiter workspace member ID (optional)', required: false },
] as const;
