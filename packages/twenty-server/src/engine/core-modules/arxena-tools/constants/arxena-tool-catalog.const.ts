export type ArxenaToolCatalogEntry = {
  name: string;
  label: string;
  description: string;
};

// Built-in Arxena tools exposed via ToolCategory.ARXENA.
// Schemas are loaded on demand via learn_tools (from MCP catalog cache).
export const ARXENA_TOOL_CATALOG: readonly ArxenaToolCatalogEntry[] = [
  {
    name: 'read_agent_notes',
    label: 'Read Agent Notes',
    description:
      'Read Agent Notes.',
  },
  {
    name: 'append_agent_note',
    label: 'Append Agent Note',
    description:
      'Append Agent Note.',
  },
  {
    name: 'send_chat',
    label: 'Send Chat',
    description: 'Send Chat.',
  },
  {
    name: 'get_all_messages_by_candidate_id',
    label: 'Get All Messages By Candidate Id',
    description:
      'Get All Messages By Candidate Id.',
  },
  {
    name: 'share_jd_to_candidate',
    label: 'Share Jd To Candidate',
    description:
      'Share Jd To Candidate.',
  },
  {
    name: 'upload_jd',
    label: 'Upload Jd',
    description:
      'Upload Jd.',
  },
  {
    name: 'send_bulk_chats_by_candidate_ids',
    label: 'Send Bulk Chats By Candidate Ids',
    description:
      'Send Bulk Chats By Candidate Ids.',
  },
  {
    name: 'search_apollo_people',
    label: 'Search Apollo People',
    description:
      'Search Apollo people for prospecting. Prefer when the user asks for Apollo-specific people search.',
  },
  {
    name: 'search_apollo_companies',
    label: 'Search Apollo Companies',
    description:
      'Search Apollo Companies.',
  },
  {
    name: 'parse_job_description',
    label: 'Parse Job Description',
    description:
      'Parse Job Description.',
  },
  {
    name: 'job_brief_understanding',
    label: 'Job Brief Understanding',
    description:
      'Job Brief Understanding.',
  },
  {
    name: 'expand_companies',
    label: 'Expand Companies',
    description:
      'Expand Companies.',
  },
  {
    name: 'expand_job_titles',
    label: 'Expand Job Titles',
    description:
      'Expand Job Titles.',
  },
  {
    name: 'list_candidates_for_project',
    label: 'List Candidates For Project',
    description:
      'List Candidates For Project.',
  },
  {
    name: 'find_candidate_in_arxena_internal',
    label: 'Find Candidate In Arxena Internal',
    description:
      'Find Candidate In Arxena Internal.',
  },
  {
    name: 'get_candidate_details_in_arxena_internal',
    label: 'Get Candidate Details In Arxena Internal',
    description:
      'Get Candidate Details In Arxena Internal.',
  },
  {
    name: 'create_candidate',
    label: 'Create Candidate',
    description:
      'Create Candidate.',
  },
  {
    name: 'update_candidate_status',
    label: 'Update Candidate Status',
    description:
      'Update Candidate Status.',
  },
  {
    name: 'update_candidate_phone',
    label: 'Update Candidate Phone',
    description:
      'Update Candidate Phone.',
  },
  {
    name: 'update_candidate_salary',
    label: 'Update Candidate Salary',
    description:
      'Update Candidate Salary.',
  },
  {
    name: 'update_candidate_remarks',
    label: 'Update Candidate Remarks',
    description:
      'Update Candidate Remarks.',
  },
  {
    name: 'get_candidates_by_project_id',
    label: 'Get Candidates By Project Id',
    description:
      'Get Candidates By Project Id.',
  },
  {
    name: 'upload_profiles',
    label: 'Upload Profiles',
    description:
      'Upload Profiles.',
  },
  {
    name: 'post_candidates',
    label: 'Post Candidates',
    description:
      'Post Candidates.',
  },
  {
    name: 'refresh_table_data',
    label: 'Refresh Table Data',
    description:
      'Refresh Table Data.',
  },
  {
    name: 'process_ai_filters',
    label: 'Process Ai Filters',
    description:
      'Process Ai Filters.',
  },
  {
    name: 'process_filter_description',
    label: 'Process Filter Description',
    description:
      'Process Filter Description.',
  },
  // {
  //   name: 'list_companies',
  //   label: 'List Companies',
  //   description:
  //     'List Companies.',
  // },
  // {
  //   name: 'get_company_by_id',
  //   label: 'Get Company By Id',
  //   description:
  //     'Get Company By Id.',
  // },
  // {
  //   name: 'find_company_by_name',
  //   label: 'Find Company By Name',
  //   description:
  //     'Find Company By Name.',
  // },
  // {
  //   name: 'find_companies_by_name',
  //   label: 'Find Companies By Name',
  //   description:
  //     'Find Companies By Name.',
  // },
  // {
  //   name: 'create_company',
  //   label: 'Create Company',
  //   description:
  //     'Create Company.',
  // },
  {
    name: 'search_people_index',
    label: 'Search People Index',
    description:
      'Search People Index.',
  },
  {
    name: 'search_companies_index',
    label: 'Search Companies Index',
    description:
      'Search Companies Index.',
  },
  {
    name: 'resolve_company_from_raw_name',
    label: 'Resolve Company From Raw Name',
    description:
      'Resolve a messy / raw company name to a standardized company profile from std_company_data_scores (name, id, website, LinkedIn URL, headcount).',
  },
  {
    name: 'search_wikidata_companies',
    label: 'Search Wikidata Companies',
    description:
      'Look up company details on Wikidata by official website domain (P856) or company name. Returns structured firmographics (HQ, industry, employees, executives, stock listing).',
  },
  {
    name: 'get_elasticsearch_index_status',
    label: 'Get Elasticsearch Index Status',
    description:
      'Get Elasticsearch Index Status.',
  },
  {
    name: 'search_linkedin_people',
    label: 'Search Linkedin People',
    description:
      'Search LinkedIn people (classic / sales_navigator / recruiter). Sales Navigator needs include/exclude objects and role (not classic flat arrays or job_title).',
  },
  {
    name: 'search_linkedin_companies',
    label: 'Search Linkedin Companies',
    description:
      'Search Linkedin Companies.',
  },
  {
    name: 'search_linkedin_jobs',
    label: 'Search Linkedin Jobs',
    description:
      'Search Linkedin Jobs.',
  },
  {
    name: 'search_linkedin_posts',
    label: 'Search Linkedin Posts',
    description:
      'Search Linkedin Posts.',
  },
  {
    name: 'search_linkedin_from_url',
    label: 'Search Linkedin From Url',
    description:
      'Search Linkedin From Url.',
  },
  {
    name: 'search_linkedin_continue',
    label: 'Search Linkedin Continue',
    description:
      'Search Linkedin Continue.',
  },
  {
    name: 'list_linkedin_relations',
    label: 'List Linkedin Relations',
    description:
      'List recently added LinkedIn 1st-degree connections (last n relations) for the connected Unipile account.',
  },
  {
    name: 'linkedin_unipile_get_own_profile',
    label: 'Get Own LinkedIn Profile',
    description:
      'Retrieve the connected LinkedIn account owner profile via Unipile (GET /users/me). Pass accountId from Connected Accounts. Use when the user asks about their own LinkedIn profile, premium/Sales Nav/Recruiter status, or identity.',
  },
  {
    name: 'linkedin_unipile_get_profile',
    label: 'Get LinkedIn Profile',
    description:
      'Retrieve one LinkedIn profile by /in/slug or provider_id via Unipile. Pass account_id from Connected Accounts. Optional linkedin_api=sales_navigator|recruiter for product-specific provider_id. For searching many profiles use search_linkedin_people instead. For chat history prefer fetch_linkedin_messages.',
  },
  {
    name: 'fetch_linkedin_messages',
    label: 'Fetch LinkedIn Messages',
    description:
      'Fetch LinkedIn chat messages by linkedinUrl / linkedinProfileId / candidateId. Returns local chatMessage transcript when present; otherwise Unipile (profile → chats → messages). Pass forceRefresh to bypass cache; linkedinApi=sales_navigator for Sales Navigator inbox history.',
  },
  {
    name: 'visit_linkedin_profile',
    label: 'Visit LinkedIn Profile',
    description:
      'Visit a LinkedIn profile via Unipile so the viewee is notified (marks a profile view). Pass linkedinUrl / linkedinProfileId / candidateId. Same as workflow step VIEW_LINKEDIN_PROFILE. Lightweight — not a full profile fetch; use linkedin_unipile_get_profile for enrichment (silent by default).',
  },
  {
    name: 'linkedin_unipile_like_post',
    label: 'Like LinkedIn Post',
    description:
      'React to a LinkedIn post via Unipile (POST /posts/reaction). Pass post social_id from FETCH_LINKEDIN_ACTIVITY / linkedin_unipile_get_user_posts. Same as workflow step LIKE_LINKEDIN_POST.',
  },
  {
    name: 'linkedin_unipile_follow_profile',
    label: 'Follow LinkedIn Profile',
    description:
      'Follow a LinkedIn profile via Unipile magic route. Resolves private provider_id (ACo…) when needed. Same as workflow step FOLLOW_LINKEDIN_PROFILE.',
  },
  {
    name: 'linkedin_unipile_send_voice_note',
    label: 'Send LinkedIn Voice Note',
    description:
      'Send a LinkedIn voice note via Unipile (voice_message on POST /chats). Prefer .m4a. Same as workflow step SEND_LINKEDIN_VOICE_NOTE — outbound voice is workflow-step oriented.',
  },
  {
    name: 'linkedin_unipile_get_user_posts',
    label: 'Get LinkedIn User Posts',
    description:
      'Fetch recent posts authored by a LinkedIn user/company via Unipile (GET /users/{identifier}/posts). Returns social_id on each post — use that social_id to comment (workflow step COMMENT_ON_LINKEDIN_POST) or like (LIKE_LINKEDIN_POST), not the URL post id. Different from keyword search_linkedin_posts / LF search-posts.',
  },
  {
    name: 'linkedin_unipile_get_user_comments',
    label: 'Get LinkedIn User Comments',
    description:
      'Fetch comments written by a LinkedIn user via Unipile (GET /users/{identifier}/comments). This is comments-by-user activity, not posting a comment. To comment on a post, use workflow step COMMENT_ON_LINKEDIN_POST with the post social_id.',
  },
  {
    name: 'linkedin_unipile_get_profile_overview',
    label: 'Get LinkedIn Profile Overview',
    description:
      'Fetch a LinkedIn person profile plus recent posts (and optional recruiting_activity) in one Unipile call. Prefer this when you need profile + posts together; use linkedin_unipile_get_user_posts alone when you only need posts. Posts include social_id for commenting.',
  },
  {
    name: 'search_linkedin_parameters',
    label: 'Search Linkedin Parameters',
    description:
      'Resolve LinkedIn facet IDs (location, industry, …) and Sales Nav LEAD_LISTS / ACCOUNT_LISTS for the connected account.',
  },
  {
    name: 'generate_linkedin_query_set',
    label: 'Generate Linkedin Query Set',
    description:
      'Generate Linkedin Query Set.',
  },
  {
    name: 'generate_linkedin_query_batch',
    label: 'Generate Linkedin Query Batch',
    description:
      'Generate Linkedin Query Batch.',
  },
  {
    name: 'validate_linkedin_query_set',
    label: 'Validate Linkedin Query Set',
    description:
      'Validate Linkedin Query Set.',
  },
  {
    name: 'check_contact_availability',
    label: 'Check Contact Availability',
    description:
      'Waterfall check whether email/phone exist across providers. Prefer over single-provider check tools unless the user names a provider.',
  },
  {
    name: 'check_contact_availability_from_arxena',
    label: 'Check Contact Availability From Arxena',
    description:
      'Check Contact Availability From Arxena.',
  },
  // {
  //   name: 'check_contact_availability_from_pdl',
  //   label: 'Check Contact Availability From Pdl',
  //   description:
  //     'Check Contact Availability From Pdl.',
  // },
  {
    name: 'check_contact_availability_from_contactout',
    label: 'Check Contact Availability From Contactout',
    description:
      'Check Contact Availability From Contactout.',
  },
  {
    name: 'check_contact_availability_from_lusha',
    label: 'Check Contact Availability From Lusha',
    description:
      'Check Contact Availability From Lusha.',
  },
  {
    name: 'check_contact_availability_from_apollo',
    label: 'Check Contact Availability From Apollo',
    description:
      'Check Contact Availability From Apollo.',
  },
  {
    name: 'fetch_contacts',
    label: 'Fetch Contacts',
    description:
      'Waterfall fetch email and phone across providers. Prefer over single-provider fetch tools unless the user names a provider. Use fetch_email / fetch_phone when only one is needed.',
  },
  {
    name: 'fetch_email',
    label: 'Fetch Email',
    description:
      'Waterfall fetch email only (wantEmail=true, wantPhone=false). Prefer over fetch_contacts when the user only needs email.',
  },
  {
    name: 'fetch_phone',
    label: 'Fetch Phone',
    description:
      'Waterfall fetch phone only (wantEmail=false, wantPhone=true). Prefer over fetch_contacts when the user only needs phone.',
  },
  {
    name: 'fetch_contacts_from_arxena',
    label: 'Fetch Contacts From Arxena',
    description:
      'Fetch Contacts From Arxena.',
  },
  // {
  //   name: 'fetch_contacts_from_pdl',
  //   label: 'Fetch Contacts From Pdl',
  //   description:
  //     'Fetch Contacts From Pdl.',
  // },
  {
    name: 'fetch_contacts_from_contactout',
    label: 'Fetch Contacts From Contactout',
    description:
      'Fetch Contacts From Contactout.',
  },
  {
    name: 'fetch_contacts_from_lusha',
    label: 'Fetch Contacts From Lusha',
    description:
      'Fetch Contacts From Lusha.',
  },
  {
    name: 'fetch_contacts_from_apollo',
    label: 'Fetch Contacts From Apollo',
    description:
      'Fetch Contacts From Apollo.',
  },
  {
    name: 'get_contact_enrichment_job',
    label: 'Get Contact Enrichment Job',
    description:
      'Get Contact Enrichment Job.',
  },
  {
    name: 'list_org_chart_positions',
    label: 'List Org Chart Positions',
    description:
      'List compact org-chart positions (headline, taxonomy, peopleCount, node keys) without embedded people. Use first for account mapping; then get_org_chart_node_people for shortlisted nodes.',
  },
  {
    name: 'get_org_chart',
    label: 'Get Org Chart',
    description:
      'Load the full org-chart payload (includes embedded people). Prefer list_org_chart_positions for Ask AI structure walks — full charts often exceed size limits.',
  },
  {
    name: 'search_org_charts_by_country',
    label: 'Search Org Charts By Country',
    description:
      'Search Org Charts By Country.',
  },
  {
    name: 'search_org_charts_by_function',
    label: 'Search Org Charts By Function',
    description:
      'Search Org Charts By Function.',
  },
  {
    name: 'get_org_chart_node_people',
    label: 'Get Org Chart Node People',
    description:
      'List stored org-chart people for a shortlisted node (name, job title, headline, summary). REQUIRED: nodeKey (preferred, from list_org_chart_positions) or stdFunction / stdFunctionRoot — do not call with only companyId. Source is the saved chart + candidates.json, not people_all.',
  },
  {
    name: 'google_serp_search',
    label: 'Google Serp Search',
    description:
      'Google organic web search (title, url, snippet). Use after get_org_chart_node_people to corroborate named people; do not use it as the people source.',
  },
  {
    name: 'get_pending_recruiter_actions',
    label: 'Get Pending Recruiter Actions',
    description:
      'Get Pending Recruiter Actions.',
  },
  {
    name: 'search_people_by_job_title',
    label: 'Search People By Job Title',
    description:
      'Alias of search_people_api (jobTitle maps to naturalLanguage).',
  },
  {
    name: 'search_people_api',
    label: 'Search People Api',
    description:
      'Search people with naturalLanguage (e.g. "CEO at StayVista") or explicit std filters.',
  },
  {
    name: 'search_bright_data_business',
    label: 'Search Bright Data Business',
    description:
      'Bright Data Business Search for companies or people from a raw natural-language request. Always ludicrous (any mode is ignored): first call returns a budget (planId, match counts per slice, expected accuracy, cost at $0.002 per record); call again with planId and maxBudgetUsd (max $10) after the user confirms. The result has counts and a summary, never the records. Records are fetched with the full view and kept for 30 days under the planId (call again with planId + projectId to write them at no charge). Pass projectId to write the Outreach tab. For a targeted company + position lookup ("CEO of Burger King India") pass autoExecute true with maxBudgetUsd and targetCount: it plans and fetches in one call, with no estimate or confirmation.',
  },
  {
    name: 'outreach_list',
    label: 'Search Result Lists',
    description:
      'Search results live in lists (every search tool returns a listId and counts, never rows). Actions: list, summary, peek (max 10 rows), export (CSV link to give the user), dedupe (against crm or other lists), attach (show on a project tab), save_to_crm (create CRM Company / Person records tagged to a project, never enrolled), delete. Lists last 30 days (paid sources) or 7 (free), extended when used. Never read a whole list into the chat.',
  },
  {
    name: 'search_local_businesses',
    label: 'Search Local Businesses',
    description:
      'Search Google Maps local businesses / POIs by query (hotels, plumbers, restaurants, etc.).',
  },
  {
    name: 'search_local_businesses_nearby',
    label: 'Search Local Businesses Nearby',
    description: 'Search Google Maps businesses near a lat/lng coordinate.',
  },
  {
    name: 'get_local_business_details',
    label: 'Get Local Business Details',
    description:
      'Fetch full business details (optional emails/socials) by business id(s).',
  },
  {
    name: 'autocomplete_local_businesses',
    label: 'Autocomplete Local Businesses',
    description:
      'Google Maps place/business/query autocomplete for local-business search.',
  },
  {
    name: 'list_people_data_sources',
    label: 'List People Data Sources',
    description:
      'List People Data Sources.',
  },
  {
    name: 'list_taxonomy_constants',
    label: 'List Taxonomy Constants',
    description:
      'List Taxonomy Constants. Public grade levels, grade categories and function roots; use to understand the vocabulary, then prefer search_people_api with naturalLanguage.',
  },
  {
    name: 'list_taxonomy_function_roots',
    label: 'List Taxonomy Function Roots',
    description:
      'List Taxonomy Function Roots.',
  },
  {
    name: 'list_taxonomy_functions',
    label: 'List Taxonomy Functions',
    description:
      'List Taxonomy Functions.',
  },
  {
    name: 'list_taxonomy_grades',
    label: 'List Taxonomy Grades',
    description:
      'List Taxonomy Grades.',
  },
  {
    name: 'list_taxonomy_slice',
    label: 'List Taxonomy Slice',
    description:
      'List child std_function labels for one root plus std_grade nouns.',
  },
  {
    name: 'classify_taxonomy_profile',
    label: 'Classify Taxonomy Profile',
    description:
      'Classify a formatted profile or job title into std function/grade labels. Prefer search_people_api with naturalLanguage to find people.',
  },
  {
    name: 'enrich_contact_from_data',
    label: 'Enrich Contact From Data',
    description:
      'Enrich Contact From Data.',
  },
  // {
  //   name: 'list_active_projects',
  //   label: 'List Active Projects',
  //   description:
  //     'List Active Projects.',
  // },
  // {
  //   name: 'get_project_by_id',
  //   label: 'Get Project By Id',
  //   description:
  //     'Get Project By Id.',
  // },
  // {
  //   name: 'find_project_by_name',
  //   label: 'Find Project By Name',
  //   description:
  //     'Find Project By Name.',
  // },
  // {
  //   name: 'create_project',
  //   label: 'Create Project',
  //   description:
  //     'Create Project.',
  // },
  // {
  //   name: 'create_reminder',
  //   label: 'Create Reminder',
  //   description:
  //     'Create Reminder.',
  // },
  // {
  //   name: 'list_due_reminders',
  //   label: 'List Due Reminders',
  //   description:
  //     'List Due Reminders.',
  // },
  // {
  //   name: 'search',
  //   label: 'Search',
  //   description:
  //     'Universal search across workspace records and org charts. Prefer when intent is unclear before specialized search tools.',
  // },
  // {
  //   name: 'fetch',
  //   label: 'Fetch',
  //   description:
  //     'Fetch a workspace record or org-chart resource by id returned from search.',
  // },
  // {
  //   name: 'list_shortlists',
  //   label: 'List Shortlists',
  //   description:
  //     'List Shortlists.',
  // },
  // {
  //   name: 'create_shortlist',
  //   label: 'Create Shortlist',
  //   description:
  //     'Create Shortlist.',
  // },
  // {
  //   name: 'add_candidates_to_shortlist',
  //   label: 'Add Candidates To Shortlist',
  //   description:
  //     'Add Candidates To Shortlist.',
  // },
  // {
  //   name: 'list_cv_sents',
  //   label: 'List Cv Sents',
  //   description:
  //     'List Cv Sents.',
  // },
  // {
  //   name: 'move_candidate_to_cv_sent',
  //   label: 'Move Candidate To Cv Sent',
  //   description:
  //     'Move Candidate To Cv Sent.',
  // },
  // {
  //   name: 'whatsapp_unipile_check_account_status',
  //   label: 'Whatsapp Unipile Check Account Status',
  //   description:
  //     'Whatsapp Unipile Check Account Status.',
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
