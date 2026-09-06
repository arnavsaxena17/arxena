export type ArxenaToolPack =
  | 'prospecting'
  | 'enrichment'
  | 'orgchart'
  | 'outreach'
  | 'accounts'
  | 'crm_workspace'
  | 'general';

export type ArxenaToolCatalogEntry = {
  name: string;
  pack: ArxenaToolPack;
  label: string;
  description: string;
};

// Built-in Arxena GTM tools exposed via ToolCategory.ARXENA.
// Schemas are loaded on demand via learn_tools (from MCP catalog cache).
export const ARXENA_TOOL_CATALOG: readonly ArxenaToolCatalogEntry[] = [
  {
    name: 'read_agent_notes',
    pack: 'accounts',
    label: 'Read Agent Notes',
    description:
      'Read Agent Notes (accounts pack). Use for GTM accounts workflows.',
  },
  {
    name: 'append_agent_note',
    pack: 'accounts',
    label: 'Append Agent Note',
    description:
      'Append Agent Note (accounts pack). Use for GTM accounts workflows.',
  },
  {
    name: 'send_chat',
    pack: 'outreach',
    label: 'Send Chat',
    description: 'Send Chat (outreach pack). Use for GTM outreach workflows.',
  },
  {
    name: 'get_all_messages_by_candidate_id',
    pack: 'outreach',
    label: 'Get All Messages By Candidate Id',
    description:
      'Get All Messages By Candidate Id (outreach pack). Use for GTM outreach workflows.',
  },
  {
    name: 'share_jd_to_candidate',
    pack: 'outreach',
    label: 'Share Jd To Candidate',
    description:
      'Share Jd To Candidate (outreach pack). Use for GTM outreach workflows.',
  },
  {
    name: 'upload_jd',
    pack: 'prospecting',
    label: 'Upload Jd',
    description:
      'Upload Jd (prospecting pack). Use for GTM prospecting workflows.',
  },
  {
    name: 'send_bulk_chats_by_candidate_ids',
    pack: 'outreach',
    label: 'Send Bulk Chats By Candidate Ids',
    description:
      'Send Bulk Chats By Candidate Ids (outreach pack). Use for GTM outreach workflows.',
  },
  {
    name: 'search_apollo_people',
    pack: 'prospecting',
    label: 'Search Apollo People',
    description:
      'Search Apollo people for prospecting. Prefer when the user asks for Apollo-specific people search.',
  },
  {
    name: 'search_apollo_companies',
    pack: 'prospecting',
    label: 'Search Apollo Companies',
    description:
      'Search Apollo Companies (prospecting pack). Use for GTM prospecting workflows.',
  },
  {
    name: 'parse_job_description',
    pack: 'prospecting',
    label: 'Parse Job Description',
    description:
      'Parse Job Description (prospecting pack). Use for GTM prospecting workflows.',
  },
  {
    name: 'job_brief_understanding',
    pack: 'prospecting',
    label: 'Job Brief Understanding',
    description:
      'Job Brief Understanding (prospecting pack). Use for GTM prospecting workflows.',
  },
  {
    name: 'expand_companies',
    pack: 'prospecting',
    label: 'Expand Companies',
    description:
      'Expand Companies (prospecting pack). Use for GTM prospecting workflows.',
  },
  {
    name: 'expand_job_titles',
    pack: 'prospecting',
    label: 'Expand Job Titles',
    description:
      'Expand Job Titles (prospecting pack). Use for GTM prospecting workflows.',
  },
  {
    name: 'list_candidates_for_project',
    pack: 'accounts',
    label: 'List Candidates For Project',
    description:
      'List Candidates For Project (accounts pack). Use for GTM accounts workflows.',
  },
  {
    name: 'find_candidate_in_arxena_internal',
    pack: 'accounts',
    label: 'Find Candidate In Arxena Internal',
    description:
      'Find Candidate In Arxena Internal (accounts pack). Use for GTM accounts workflows.',
  },
  {
    name: 'get_candidate_details_in_arxena_internal',
    pack: 'accounts',
    label: 'Get Candidate Details In Arxena Internal',
    description:
      'Get Candidate Details In Arxena Internal (accounts pack). Use for GTM accounts workflows.',
  },
  {
    name: 'create_candidate',
    pack: 'accounts',
    label: 'Create Candidate',
    description:
      'Create Candidate (accounts pack). Use for GTM accounts workflows.',
  },
  {
    name: 'update_candidate_status',
    pack: 'accounts',
    label: 'Update Candidate Status',
    description:
      'Update Candidate Status (accounts pack). Use for GTM accounts workflows.',
  },
  {
    name: 'update_candidate_phone',
    pack: 'accounts',
    label: 'Update Candidate Phone',
    description:
      'Update Candidate Phone (accounts pack). Use for GTM accounts workflows.',
  },
  {
    name: 'update_candidate_salary',
    pack: 'accounts',
    label: 'Update Candidate Salary',
    description:
      'Update Candidate Salary (accounts pack). Use for GTM accounts workflows.',
  },
  {
    name: 'update_candidate_remarks',
    pack: 'accounts',
    label: 'Update Candidate Remarks',
    description:
      'Update Candidate Remarks (accounts pack). Use for GTM accounts workflows.',
  },
  {
    name: 'get_candidates_by_project_id',
    pack: 'accounts',
    label: 'Get Candidates By Project Id',
    description:
      'Get Candidates By Project Id (accounts pack). Use for GTM accounts workflows.',
  },
  {
    name: 'upload_profiles',
    pack: 'accounts',
    label: 'Upload Profiles',
    description:
      'Upload Profiles (accounts pack). Use for GTM accounts workflows.',
  },
  {
    name: 'post_candidates',
    pack: 'accounts',
    label: 'Post Candidates',
    description:
      'Post Candidates (accounts pack). Use for GTM accounts workflows.',
  },
  {
    name: 'refresh_table_data',
    pack: 'accounts',
    label: 'Refresh Table Data',
    description:
      'Refresh Table Data (accounts pack). Use for GTM accounts workflows.',
  },
  {
    name: 'process_ai_filters',
    pack: 'prospecting',
    label: 'Process Ai Filters',
    description:
      'Process Ai Filters (prospecting pack). Use for GTM prospecting workflows.',
  },
  {
    name: 'process_filter_description',
    pack: 'prospecting',
    label: 'Process Filter Description',
    description:
      'Process Filter Description (prospecting pack). Use for GTM prospecting workflows.',
  },
  {
    name: 'send_shortlist_to_client',
    pack: 'outreach',
    label: 'Send Shortlist To Client',
    description:
      'Send Shortlist To Client (outreach pack). Use for GTM outreach workflows.',
  },
  // {
  //   name: 'list_companies',
  //   pack: 'accounts',
  //   label: 'List Companies',
  //   description:
  //     'List Companies (accounts pack). Use for GTM accounts workflows.',
  // },
  // {
  //   name: 'get_company_by_id',
  //   pack: 'accounts',
  //   label: 'Get Company By Id',
  //   description:
  //     'Get Company By Id (accounts pack). Use for GTM accounts workflows.',
  // },
  // {
  //   name: 'find_company_by_name',
  //   pack: 'accounts',
  //   label: 'Find Company By Name',
  //   description:
  //     'Find Company By Name (accounts pack). Use for GTM accounts workflows.',
  // },
  // {
  //   name: 'find_companies_by_name',
  //   pack: 'accounts',
  //   label: 'Find Companies By Name',
  //   description:
  //     'Find Companies By Name (accounts pack). Use for GTM accounts workflows.',
  // },
  // {
  //   name: 'create_company',
  //   pack: 'accounts',
  //   label: 'Create Company',
  //   description:
  //     'Create Company (accounts pack). Use for GTM accounts workflows.',
  // },
  {
    name: 'search_people_index',
    pack: 'prospecting',
    label: 'Search People Index',
    description:
      'Search People Index (prospecting pack). Use for GTM prospecting workflows.',
  },
  {
    name: 'search_companies_index',
    pack: 'prospecting',
    label: 'Search Companies Index',
    description:
      'Search Companies Index (prospecting pack). Use for GTM prospecting workflows.',
  },
  {
    name: 'search_wikidata_companies',
    pack: 'prospecting',
    label: 'Search Wikidata Companies',
    description:
      'Look up company details on Wikidata by official website domain (P856) or company name. Returns structured firmographics (HQ, industry, employees, executives, stock listing).',
  },
  {
    name: 'get_elasticsearch_index_status',
    pack: 'prospecting',
    label: 'Get Elasticsearch Index Status',
    description:
      'Get Elasticsearch Index Status (prospecting pack). Use for GTM prospecting workflows.',
  },
  {
    name: 'search_linkedin_with_query',
    pack: 'prospecting',
    label: 'Search Linkedin With Query',
    description:
      'Run LinkedIn search with a structured query. Prefer after generating or validating a LinkedIn query.',
  },
  {
    name: 'search_linkedin_people',
    pack: 'prospecting',
    label: 'Search Linkedin People',
    description:
      'Search LinkedIn people (classic / sales_navigator / recruiter). Sales Navigator needs include/exclude objects and role (not classic flat arrays or job_title).',
  },
  {
    name: 'search_linkedin_companies',
    pack: 'prospecting',
    label: 'Search Linkedin Companies',
    description:
      'Search Linkedin Companies (prospecting pack). Use for GTM prospecting workflows.',
  },
  {
    name: 'search_linkedin_jobs',
    pack: 'prospecting',
    label: 'Search Linkedin Jobs',
    description:
      'Search Linkedin Jobs (prospecting pack). Use for GTM prospecting workflows.',
  },
  {
    name: 'search_linkedin_posts',
    pack: 'prospecting',
    label: 'Search Linkedin Posts',
    description:
      'Search Linkedin Posts (prospecting pack). Use for GTM prospecting workflows.',
  },
  {
    name: 'search_linkedin_from_url',
    pack: 'prospecting',
    label: 'Search Linkedin From Url',
    description:
      'Search Linkedin From Url (prospecting pack). Use for GTM prospecting workflows.',
  },
  {
    name: 'search_linkedin_continue',
    pack: 'prospecting',
    label: 'Search Linkedin Continue',
    description:
      'Search Linkedin Continue (prospecting pack). Use for GTM prospecting workflows.',
  },
  {
    name: 'list_linkedin_relations',
    pack: 'prospecting',
    label: 'List Linkedin Relations',
    description:
      'List recently added LinkedIn 1st-degree connections (last n relations) for the connected Unipile account.',
  },
  {
    name: 'search_linkedin_parameters',
    pack: 'prospecting',
    label: 'Search Linkedin Parameters',
    description:
      'Search Linkedin Parameters (prospecting pack). Use for GTM prospecting workflows.',
  },
  {
    name: 'generate_linkedin_query_set',
    pack: 'prospecting',
    label: 'Generate Linkedin Query Set',
    description:
      'Generate Linkedin Query Set (prospecting pack). Use for GTM prospecting workflows.',
  },
  {
    name: 'generate_linkedin_query_batch',
    pack: 'prospecting',
    label: 'Generate Linkedin Query Batch',
    description:
      'Generate Linkedin Query Batch (prospecting pack). Use for GTM prospecting workflows.',
  },
  {
    name: 'validate_linkedin_query_set',
    pack: 'prospecting',
    label: 'Validate Linkedin Query Set',
    description:
      'Validate Linkedin Query Set (prospecting pack). Use for GTM prospecting workflows.',
  },
  {
    name: 'check_contact_availability',
    pack: 'enrichment',
    label: 'Check Contact Availability',
    description:
      'Waterfall check whether email/phone exist across providers. Prefer over single-provider check tools unless the user names a provider.',
  },
  {
    name: 'check_contact_availability_from_arxena',
    pack: 'enrichment',
    label: 'Check Contact Availability From Arxena',
    description:
      'Check Contact Availability From Arxena (enrichment pack). Use for GTM enrichment workflows.',
  },
  // {
  //   name: 'check_contact_availability_from_pdl',
  //   pack: 'enrichment',
  //   label: 'Check Contact Availability From Pdl',
  //   description:
  //     'Check Contact Availability From Pdl (enrichment pack). Use for GTM enrichment workflows.',
  // },
  {
    name: 'check_contact_availability_from_contactout',
    pack: 'enrichment',
    label: 'Check Contact Availability From Contactout',
    description:
      'Check Contact Availability From Contactout (enrichment pack). Use for GTM enrichment workflows.',
  },
  {
    name: 'check_contact_availability_from_lusha',
    pack: 'enrichment',
    label: 'Check Contact Availability From Lusha',
    description:
      'Check Contact Availability From Lusha (enrichment pack). Use for GTM enrichment workflows.',
  },
  {
    name: 'check_contact_availability_from_apollo',
    pack: 'enrichment',
    label: 'Check Contact Availability From Apollo',
    description:
      'Check Contact Availability From Apollo (enrichment pack). Use for GTM enrichment workflows.',
  },
  {
    name: 'fetch_contacts',
    pack: 'enrichment',
    label: 'Fetch Contacts',
    description:
      'Waterfall fetch email/phone across providers. Prefer over single-provider fetch tools unless the user names a provider.',
  },
  {
    name: 'fetch_contacts_from_arxena',
    pack: 'enrichment',
    label: 'Fetch Contacts From Arxena',
    description:
      'Fetch Contacts From Arxena (enrichment pack). Use for GTM enrichment workflows.',
  },
  // {
  //   name: 'fetch_contacts_from_pdl',
  //   pack: 'enrichment',
  //   label: 'Fetch Contacts From Pdl',
  //   description:
  //     'Fetch Contacts From Pdl (enrichment pack). Use for GTM enrichment workflows.',
  // },
  {
    name: 'fetch_contacts_from_contactout',
    pack: 'enrichment',
    label: 'Fetch Contacts From Contactout',
    description:
      'Fetch Contacts From Contactout (enrichment pack). Use for GTM enrichment workflows.',
  },
  {
    name: 'fetch_contacts_from_lusha',
    pack: 'enrichment',
    label: 'Fetch Contacts From Lusha',
    description:
      'Fetch Contacts From Lusha (enrichment pack). Use for GTM enrichment workflows.',
  },
  {
    name: 'fetch_contacts_from_apollo',
    pack: 'enrichment',
    label: 'Fetch Contacts From Apollo',
    description:
      'Fetch Contacts From Apollo (enrichment pack). Use for GTM enrichment workflows.',
  },
  {
    name: 'get_contact_enrichment_job',
    pack: 'enrichment',
    label: 'Get Contact Enrichment Job',
    description:
      'Get Contact Enrichment Job (enrichment pack). Use for GTM enrichment workflows.',
  },
  {
    name: 'list_org_chart_positions',
    pack: 'orgchart',
    label: 'List Org Chart Positions',
    description:
      'List compact org-chart positions (headline, taxonomy, peopleCount, node keys) without embedded people. Use first for account mapping; then get_org_chart_node_people for shortlisted nodes.',
  },
  {
    name: 'get_org_chart',
    pack: 'orgchart',
    label: 'Get Org Chart',
    description:
      'Load the full org-chart payload (includes embedded people). Prefer list_org_chart_positions for Ask AI structure walks — full charts often exceed size limits.',
  },
  {
    name: 'search_org_charts_by_country',
    pack: 'orgchart',
    label: 'Search Org Charts By Country',
    description:
      'Search Org Charts By Country (orgchart pack). Use for GTM orgchart workflows.',
  },
  {
    name: 'search_org_charts_by_function',
    pack: 'orgchart',
    label: 'Search Org Charts By Function',
    description:
      'Search Org Charts By Function (orgchart pack). Use for GTM orgchart workflows.',
  },
  {
    name: 'get_org_chart_node_people',
    pack: 'orgchart',
    label: 'Get Org Chart Node People',
    description:
      'List stored org-chart people for a shortlisted node (name, job title, headline, summary). REQUIRED: nodeKey (preferred, from list_org_chart_positions) or stdFunction / stdFunctionRoot — do not call with only companyId. Source is the saved chart + candidates.json, not people_all.',
  },
  {
    name: 'google_serp_search',
    pack: 'orgchart',
    label: 'Google Serp Search',
    description:
      'Google organic web search (title, url, snippet). Use after get_org_chart_node_people to corroborate named people; do not use it as the people source.',
  },
  {
    name: 'get_pending_recruiter_actions',
    pack: 'accounts',
    label: 'Get Pending Recruiter Actions',
    description:
      'Get Pending Recruiter Actions (accounts pack). Use for GTM accounts workflows.',
  },
  {
    name: 'search_people_by_job_title',
    pack: 'prospecting',
    label: 'Search People By Job Title',
    description:
      'Alias of search_people_api (jobTitle maps to naturalLanguage). Use for GTM prospecting workflows.',
  },
  {
    name: 'search_people_api',
    pack: 'prospecting',
    label: 'Search People Api',
    description:
      'Search people with naturalLanguage (e.g. "CEO at StayVista") or explicit std filters. Use for GTM prospecting workflows.',
  },
  {
    name: 'list_people_data_sources',
    pack: 'prospecting',
    label: 'List People Data Sources',
    description:
      'List People Data Sources (prospecting pack). Use for GTM prospecting workflows.',
  },
  {
    name: 'list_taxonomy_function_roots',
    pack: 'prospecting',
    label: 'List Taxonomy Function Roots',
    description:
      'List Taxonomy Function Roots (prospecting pack). Use for GTM prospecting workflows.',
  },
  {
    name: 'list_taxonomy_functions',
    pack: 'prospecting',
    label: 'List Taxonomy Functions',
    description:
      'List Taxonomy Functions (prospecting pack). Use for GTM prospecting workflows.',
  },
  {
    name: 'list_taxonomy_grades',
    pack: 'prospecting',
    label: 'List Taxonomy Grades',
    description:
      'List Taxonomy Grades (prospecting pack). Use for GTM prospecting workflows.',
  },
  {
    name: 'list_taxonomy_slice',
    pack: 'prospecting',
    label: 'List Taxonomy Slice',
    description:
      'List child std_function labels for one root plus std_grade nouns (prospecting pack).',
  },
  {
    name: 'classify_taxonomy_profile',
    pack: 'prospecting',
    label: 'Classify Taxonomy Profile',
    description:
      'Classify a formatted profile or job title into std function/grade labels (prospecting pack). Prefer search_people_api with naturalLanguage to find people.',
  },
  {
    name: 'find_person_in_arxena_internal',
    pack: 'accounts',
    label: 'Find Person In Arxena Internal',
    description:
      'Find Person In Arxena Internal (accounts pack). Use for GTM accounts workflows.',
  },
  {
    name: 'update_contact_info_in_arxena_internal',
    pack: 'accounts',
    label: 'Update Contact Info In Arxena Internal',
    description:
      'Update Contact Info In Arxena Internal (accounts pack). Use for GTM accounts workflows.',
  },
  {
    name: 'get_candidate_fields_for_project',
    pack: 'accounts',
    label: 'Get Candidate Fields For Project',
    description:
      'Get Candidate Fields For Project (accounts pack). Use for GTM accounts workflows.',
  },
  {
    name: 'get_candidate_field_values',
    pack: 'accounts',
    label: 'Get Candidate Field Values',
    description:
      'Get Candidate Field Values (accounts pack). Use for GTM accounts workflows.',
  },
  {
    name: 'enrich_contact_from_data',
    pack: 'enrichment',
    label: 'Enrich Contact From Data',
    description:
      'Enrich Contact From Data (enrichment pack). Use for GTM enrichment workflows.',
  },
  // {
  //   name: 'list_active_projects',
  //   pack: 'accounts',
  //   label: 'List Active Projects',
  //   description:
  //     'List Active Projects (accounts pack). Use for GTM accounts workflows.',
  // },
  // {
  //   name: 'get_project_by_id',
  //   pack: 'accounts',
  //   label: 'Get Project By Id',
  //   description:
  //     'Get Project By Id (accounts pack). Use for GTM accounts workflows.',
  // },
  // {
  //   name: 'find_project_by_name',
  //   pack: 'accounts',
  //   label: 'Find Project By Name',
  //   description:
  //     'Find Project By Name (accounts pack). Use for GTM accounts workflows.',
  // },
  // {
  //   name: 'create_project',
  //   pack: 'accounts',
  //   label: 'Create Project',
  //   description:
  //     'Create Project (accounts pack). Use for GTM accounts workflows.',
  // },
  // {
  //   name: 'create_reminder',
  //   pack: 'accounts',
  //   label: 'Create Reminder',
  //   description:
  //     'Create Reminder (accounts pack). Use for GTM accounts workflows.',
  // },
  // {
  //   name: 'list_due_reminders',
  //   pack: 'accounts',
  //   label: 'List Due Reminders',
  //   description:
  //     'List Due Reminders (accounts pack). Use for GTM accounts workflows.',
  // },
  // {
  //   name: 'search',
  //   pack: 'general',
  //   label: 'Search',
  //   description:
  //     'Universal search across workspace records and org charts. Prefer when intent is unclear before specialized search tools.',
  // },
  // {
  //   name: 'fetch',
  //   pack: 'general',
  //   label: 'Fetch',
  //   description:
  //     'Fetch a workspace record or org-chart resource by id returned from search.',
  // },
  // {
  //   name: 'list_shortlists',
  //   pack: 'accounts',
  //   label: 'List Shortlists',
  //   description:
  //     'List Shortlists (accounts pack). Use for GTM accounts workflows.',
  // },
  // {
  //   name: 'create_shortlist',
  //   pack: 'accounts',
  //   label: 'Create Shortlist',
  //   description:
  //     'Create Shortlist (accounts pack). Use for GTM accounts workflows.',
  // },
  // {
  //   name: 'add_candidates_to_shortlist',
  //   pack: 'accounts',
  //   label: 'Add Candidates To Shortlist',
  //   description:
  //     'Add Candidates To Shortlist (accounts pack). Use for GTM accounts workflows.',
  // },
  // {
  //   name: 'list_cv_sents',
  //   pack: 'accounts',
  //   label: 'List Cv Sents',
  //   description:
  //     'List Cv Sents (accounts pack). Use for GTM accounts workflows.',
  // },
  // {
  //   name: 'move_candidate_to_cv_sent',
  //   pack: 'accounts',
  //   label: 'Move Candidate To Cv Sent',
  //   description:
  //     'Move Candidate To Cv Sent (accounts pack). Use for GTM accounts workflows.',
  // },
  // {
  //   name: 'whatsapp_unipile_check_account_status',
  //   pack: 'outreach',
  //   label: 'Whatsapp Unipile Check Account Status',
  //   description:
  //     'Whatsapp Unipile Check Account Status (outreach pack). Use for GTM outreach workflows.',
  // },
] as const;

export const ARXENA_TOOL_NAMES = new Set(
  ARXENA_TOOL_CATALOG.map((entry) => entry.name),
);

export const ARXENA_INTERNAL_TOOL_NAMES = new Set([
  'generate_linkedin_query_agent1',
  'generate_linkedin_query_agent2',
  'generate_linkedin_query_agent3',
  'generate_linkedin_query_agent4',
  'generate_unresolved_search_parameters',
  'resolve_parameters',
]);
