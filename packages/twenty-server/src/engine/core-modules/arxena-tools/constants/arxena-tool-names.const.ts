// Exact tool name strings shared by the library handlers, feature flags,
// sourcing playbook, and eval allowlists. Handlers own schema + behavior;
// this file only unifies the string so callers do not hand-duplicate it.

export const SEARCH_APOLLO_PEOPLE_TOOL_NAME = 'search_apollo_people';
export const SEARCH_APOLLO_COMPANIES_TOOL_NAME = 'search_apollo_companies';
export const SEARCH_PEOPLE_INDEX_TOOL_NAME = 'search_people_index';
export const SEARCH_FIND_CANDIDATE_INTERNAL_TOOL_NAME =
  'find_candidate_in_arxena_internal';
export const SEARCH_EXA_TOOL_NAME = 'exa_web_search';
export const SEARCH_EXA_APP_TOOL_NAME = 'app_exa_web_search';
export const SEARCH_SERP_TOOL_NAME = 'google_serp_search';
export const SEARCH_COMPANIES_INDEX_TOOL_NAME = 'search_companies_index';
export const SEARCH_WIKIDATA_COMPANIES_TOOL_NAME = 'search_wikidata_companies';
export const SEARCH_BRIGHT_DATA_BUSINESS_TOOL_NAME =
  'search_bright_data_business';
export const SEARCH_LINKEDIN_PEOPLE_TOOL_NAME = 'search_linkedin_people';
export const SEARCH_LINKEDIN_COMPANIES_TOOL_NAME = 'search_linkedin_companies';
export const SEARCH_LINKEDIN_CONTINUE_TOOL_NAME = 'search_linkedin_continue';
export const SEARCH_LINKEDIN_PARAMETERS_TOOL_NAME =
  'search_linkedin_parameters';
export const GENERATE_LINKEDIN_QUERY_SET_TOOL_NAME =
  'generate_linkedin_query_set';
export const SEARCH_HARVEST_LEADS_TOOL_NAME = 'search_harvest_leads';
export const SEARCH_HARVEST_ACCOUNTS_TOOL_NAME = 'search_harvest_accounts';
export const OUTREACH_LIST_TOOL_NAME = 'outreach_list';
export const RESOLVE_COMPANY_FROM_RAW_NAME_TOOL_NAME =
  'resolve_company_from_raw_name';
