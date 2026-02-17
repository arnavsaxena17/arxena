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
